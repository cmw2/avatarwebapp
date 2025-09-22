# Avatar

## Development

1. Install Dependencies
```
npm install
```

2. Run Locally 
```
npm run dev
```

## Build
Builds the web app into the /dist folder.

```
npm run build
```

## Deploy to Azure Static Web Apps

Update the below variables and run the Azure Static Web Apps CLI command.

```
swa deploy ./dist --subscription-id "AZURE_SUBSCRIPTION_ID" --resource-group "MY-RESOURCE-GROUP" --app-name "myavatar" --env production --deployment-token "STATIC_WEB_APP_DEPLOYMENT_TOKEN"
```