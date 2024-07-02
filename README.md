# [Unmaintained] AsyncAPI To SolacePubSub+ Event Portal

This tool is used to import an AsyncAPI spec file to Event Portal. Note that it requires access to the Event Portal v2.0 which is currently under early access. If you want access please let your account team know or come chat with us over on the [Solace Community Forum](https://solace.community)

## TypeScript AsyncAPI Importer
1. [Recomended] [Typescript Async API Importer for Solace Event Portal](https://github.com/SolaceLabs/solace-tools-typescript/tree/main/packages/ep-async-api-importer)
2. [Unmaintained] JavaScript AsyncAPI Importer below

## Installation

You have two ways to use this cli tool

### 1. Install global executable

```
npm install @solace-community/asyncapi-importer -g
```

### 2. Using NPX
```
npx @solace-community/asyncapi-importer [OPTIONS]
```

## Usage

```
a2ep -f <path_to_AsyncAPI_file>
```

## Environment Variables

This tool assumes you have defined your Solace Cloud Token as an environment variable

| Env Variable       | Description                                 | Required/Optional |
| ------------------ | ------------------------------------------- | ----------------- |
| SOLACE_CLOUD_TOKEN | Solace Cloud Token with the right EP access | Required          |

## Command line arguments

| Flag             | Description                          | Notes    | Notes                                                  |
| ---------------- | ------------------------------------ | -------- | ------------------------------------------------------ |
| -f, --file       | Path to AsyncAPI file                | Required |                                                        |
| -d, --domain     | Event Portal Application Domain Name | Optional | if not defined --> asyncAPI extension |
| -dID, --domainID | Event Portal Application Domain ID   | Optional | if not defined --> asyncAPI extension |

