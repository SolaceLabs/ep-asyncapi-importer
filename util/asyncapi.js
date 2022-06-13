const { parse } = require('@asyncapi/parser')

class AsyncAPI {

  async parse(asyncAPIFile){
    let doc = await parse(asyncAPIFile)
    // return await parse(asyncAPIFile)
  }

  // Gets the title of the Application Name
  getTitle(doc) {
    return doc._json.info.title
  }

  // Gets the version of the Application
  getApplicationVersion(doc) {
    return doc._json.info.version
  }

  // Gets the version of the Application
  getApplicationDomainName(doc) {
    return doc._json["x-domain-name"]
  }

  // Gets the version of the Application
  getApplicationDomainID(doc) {
    return doc._json["x-domain-id"]
  }

  getApplicationID(doc) {
    return doc._json["x-application-id"]
  }

  getDescription(doc) {
    return doc._json.info.description
  }

  getSchemaNames(doc) {
    let schemaNames = []
    Object.entries(doc._json.components.schemas).forEach(([name, schema]) => {
      console.log(name)
      console.log(schema)
      // operation.toLowerCase() == "publish" ? publishEvents.push({channel, details}) : null
    });
    return schemaNames
  }
 
  // Returns the list of publish operation events objects
  // Note that doc is the dereferenced AsyncAPI spec
  getPublishEvents(doc){
    let publishEvents = []
    Object.entries(doc._json.channels).forEach(([channel, details]) => {
      Object.entries(details).forEach(([operation, details]) => {
        operation.toLowerCase() == "publish" ? publishEvents.push({channel, details}) : null
      });
    });
    return publishEvents
  }

  // Returns the list of subscribe operation events objects
  // Note that doc is the dereferenced AsyncAPI spec
  getSubscribeEvents(doc){
    let subscribeEvents = []
    Object.entries(doc._json.channels).forEach(([channel, details]) => {
      Object.entries(details).forEach(([operation, details]) => {
        operation.toLowerCase() == "subscribe" ? subscribeEvents.push({channel, details}) : null
      });
    });
    return subscribeEvents
  }


  // Generates a topic with dynamic variables
  // Either look into enums in props or
  // Consider using potman dynamic variables https://learning.postman.com/docs/writing-scripts/script-references/variables-list/
  generateTopic(channel){
  }

  // Geenrate Postman path given an event object
  // Leverage Postman types and enumarations
  // e.g /acme/rideshare/driver/funds/deposited/:version/:driver_id/:trip_id/:payment_id
  generatePath(event) {
    //  To-Do: Leverage topic enums and use generateTopic(event.channel)
    let path = []
    event.channel.split("/").map((level) => {
      path.push(level.replace('}','').replace('{',':'))
    })
    return path.join('/')
  }

  capitalize(s) {
    return s[0].toUpperCase() + s.slice(1);
  } 

  // Gets the name given event object
  getName(event) {
    let name = []
    event.channel.split("{")[0].split("/").map((word) => {
      word ? name.push(this.capitalize(word)) : null
    })
    return name.join(" ")
  }

  // Returns the body to be used in the REST request
  generateBody(event) {
    var schema = event.details.message.payload
    return JSON.stringify(jsf.generate(schema), null, 2)
  }

  generateBodyWithOptions(event) {
    return new Promise((resolve, reject) => {
      var schema = event.details.message.payload
      fakerOptions({
        optionalsProbability: 1.0,
        maxLength: 256,
        minItems: 1,
        maxItems: 20,
        avoidExampleItemsLength: true,
        useExamplesValue: true,
        useDefaultValue: true,
      })
      const body = fake(schema)
      resolve(body)
    })
  }

  
}

module.exports = AsyncAPI;
