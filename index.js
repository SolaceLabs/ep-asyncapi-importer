#!/usr/bin/env node

const fs = require('fs');
const commander = require('commander');
const packagejson = require('./package.json')
const AsyncAPI = require('./util/asyncAPI');
const EventPortal = require("@solace-community/eventportal");
const { parse } = require('@asyncapi/parser')
const { exit } = require('process');

async function main() {
  // Parse command line args
  commander
  .name(`npx ${packagejson.name}`)
  .description(`${packagejson.description}`)
  .version(`${packagejson.version}`, '-v, --version')
  .usage('[OPTIONS]...')
  .requiredOption('-f, --file <value>', 'Required: Path to AsyncAPI spec file')
  .option('-d, --domain  <value>', 'Application Domain Name. If not passed, name extracted from x-domain-name in spec file')
  .option('-dID, --domainID <value>', 'Application Domain ID. If not passed, ID extracted from x-domain-id in spec file')
  .parse(process.argv);

  const options = commander.opts()

  var asyncAPIFile = fs.readFileSync(options.file).toString()
  const ap = new AsyncAPI(asyncAPIFile)
  const ep = new EventPortal()

  // Validate and Dereference the AsyncAPI spec file
  let doc = await parse(asyncAPIFile)

  // Quit if Application version state is Released on EP
  const applicationName = doc.info().title()
  const applicationVersion = doc.info().version()
  const applicationDescription = doc.info().description()
  let EPApplicationID = ap.getApplicationID(doc) || await ep.getApplicationIDs(applicationName)
  const EPApplicationState = EPApplicationID.length != 0 ? await ep.getApplicationState(EPApplicationID, applicationVersion) : null

  if (EPApplicationState == "RELEASED") {
    throw new Error(`Application ${applicationName} version ${applicationVersion} is already released!`)
  }

  //  Get the application domain name from either the AsyncAPI spec or input param
  let domainName = options.domain || await ep.getApplicationDomainName(options.domainID) || ap.getApplicationDomainName(doc) ||  await ep.getApplicationDomainName(ap.getApplicationDomainID(doc))

  if (!domainName) {
    throw new Error("No Application Domain defined! Define one of the following: \n\
      - x-application-domain-name in AsyncAPI Spec file \n\
      - x-application-domain-id in AsyncAPI Spec file \n\
      - Set the -d or --domain flag \n\
      - Set the -dID or --domainID flag" 
    )
  }

  // Create Application Domain given the application domain name. Return ID if domain already exists
  let domainID = await ep.createApplicationDomain({
    name: domainName,
    description: applicationDescription, 
    uniqueTopicAddressEnforcementEnabled: true,
    topicDomainEnforcementEnabled: false, 
    type: "ApplicationDomain"
  })

  console.log("\n...Adding Schemas...")

  // Add schemas from spec file to EP
  // Note: This assumes components section is present in spec file and used to ref to schemas
  const DEFAULT_SCHEMA_VERSION = "0.0.1"
  let schemas = []
  for (var [schemaName, content] of Object.entries(doc.components().schemas())) {
    console.log("===========")
    console.log(`Adding Schema: ${schemaName}`)
    
    // Create Schema object
    let schemaID = await ep.createSchemaObject({
      applicationDomainId: domainID,
      name: schemaName,
      shared: false,
      contentType: "json",
      schemaType: "jsonSchema"
    })

    let schemaVersion = content.json()['x-schema-version'] || DEFAULT_SCHEMA_VERSION
  
    // Create Schema Version. If Schema already exists and in:
    // DRAFT state --> Override
    // Release || Deprecated || Retired state --> throw error
    let schemaVersionID = await ep.createSchemaVersion({
      schemaID: schemaID,
      description: content.description(),
      version: schemaVersion,
      displayName: schemaName,
      content: JSON.stringify(content.json()),
      stateID: content.json()['x-schema-state'] || "1"
    }, overwrite = true)

    schemas.push({
      name: schemaName,
      schemaID: schemaID,
      versionID: schemaVersionID,
    })
  }
  // console.log(schemas)

  console.log("\n...Adding Events...")
  // Add events from spec file to EP and associate schemas to them
  // Note: This assumes components section is present in spec file and used to ref to messages as events
  const DEFAULT_EVENT_VERSION = "0.0.1"
  let events = []

  for (var channelName of doc.channelNames()) {
  
    let channel = doc.channel(channelName)
    let message = channel.hasPublish() ? channel.publish().message() : channel.subscribe().message()
    let description = channel.hasPublish() ? channel.publish().message().description() : channel.subscribe().message().description()
    let operation = channel.hasPublish() ? "publish" : "subscribe"
    let eventName = message.json()['x-parser-message-name']
    let schemaName = message.json().payload ? message.json().payload['x-parser-schema-id'] : null
    let eventVersion =  message.json()['x-event-version'] || DEFAULT_EVENT_VERSION

    console.log("==========")
    console.log(`Adding event "${eventName}" with topic ${channelName}`)
  
    // Create event object given event name
    let eventID = await ep.createEventObject({
      applicationDomainId: domainID,
      name: eventName,
      shared: false
    })

    // Construct address
    let addressLevels = constructAddressLevels(channelName)
    let schemaVersionID = schemas.filter(schema => {
        return schema.name === schemaName;
      }).map(schema => {
        return schema.versionID;
      });
    
    console.log(schemaName)
    console.log(schemaVersionID)
    
    // Create Event version and associate schema version id to event
    let eventVersionID = await ep.createEventVersion({
      eventID: eventID,
      displayName: eventName,
      description: description,
      version: eventVersion,
      schemaVersionId: schemaVersionID[0],
      deliveryDescriptor:{
        brokerType: "solace",
        address:{
          addressLevels
        },
        stateID: message.json()['x-event-state'] || "1"
      }
    }, overwrite = true)
  
    events.push({
      name: eventName,
      eventID: eventID,
      versionID: eventVersionID,
      operation: operation
    })

  }
  // console.log(events)

  let applicationID = null

  console.log("\n...Adding Application...")

  // Create a new Application Version or update application with details
  if (EPApplicationID == "" || EPApplicationID == null || EPApplicationID == undefined) {
    applicationID = await ep.createApplicationObject({
      applicationDomainId: domainID,
      name: applicationName,
      applicationType: "standard",
    })
  } else {
    applicationID = EPApplicationID
  }

  let producedEvents = []
  let consumedEvents = []

  // Populate produced events
  events.filter(event => {
    return event.operation === "publish";
  }).map(event => {
    producedEvents.push(event.versionID)
  });

  // Populate consumed events
  events.filter(event => {
    return event.operation === "subscribe";
  }).map(event => {
    consumedEvents.push(event.versionID)
  });

  let applicationVersionID = await ep.createApplicationVersion({
    applicationID: applicationID,
    displayName: applicationName,
    description: applicationDescription,
    version: applicationVersion,
    declaredProducedEventVersionIds: producedEvents.flat(),
    declaredConsumedEventVersionIds: consumedEvents.flat(),
    type: "application"
  }, overwrite = true)

  console.log(`\n\nImporting done! Imported the following to Application Domain "${domainName}"`)
  console.log(`✅ Application: ${applicationName}`)
  console.log(`✅ Events: `)
  events.map(event =>{
    console.log(`   - ${event.name}`)
  })
  console.log(`✅ Schemas: `)
  schemas.map(schema =>{
    console.log(`   - ${schema.name}`)
  })

}

if (require.main === module) {
  main();
}

// Helper functions
function constructAddressLevels(topic){
  addressLevels = []

  topic.split("/").map(level => {
    let type = "literal"
    if (level.includes("{")) {
      level = level.replace('}','').replace('{','')
      type = "variable"
    }
    addressLevels.push({
      name: level,
      addressLevelType: type
    })
  })

  return addressLevels
}