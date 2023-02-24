let connectorName;
let connectorScriptSel;
let connectorScriptRun;

switch (req.body.type) {
    case "odata":
        connectorName = "OData: ";
        connectorScriptSel = '82c9459e-bc38-4df9-98d3-080bcda58b22';
        connectorScriptRun = '4a64df7b-bce9-482c-92f4-b0a8054ea75b';
        break;

    case "salesforce":
        connectorName = "Salesforce: ";
        connectorScriptSel = "dd8c5a6a-f5db-42c1-9a10-c1f74ddc7506";
        connectorScriptRun = "673eebd6-cb9e-4c85-9164-c3fea3cad947";
        break;

    default:
        break;
}


// Typeorm connection
const manager = modules.typeorm.getConnection().manager;

// Save Custom Connector
const customConnector = await entities.neptune_af_connector.save(req.body);

// Find Existing Connecors in the System
const systemConnectors = await manager.find('connector', { where: { type: "S", disabled: false } });

let foundConnector = {};

for (i = 0; i < systemConnectors.length; i++) {
    const systemConnector = systemConnectors[i];
    if (systemConnector.settings && systemConnector.settings.startParam === customConnector.id) {
        foundConnector = systemConnector;
    }
}

// Get Setup Script (ID)
const scriptSel = await manager.findOne('jsscript', {
    where: { id: connectorScriptSel },
    select: ["id"]
});

// Get Run Script (ID)
const scriptRun = await manager.findOne('jsscript', {
    where: { id: connectorScriptRun },
    select: ["id"]
});

// Auto Create Connector
if (!foundConnector.id) {
    foundConnector.type = "S";
    foundConnector.disabled = false;
    foundConnector.createdAt = new Date();
    foundConnector.createdBy = req.user.username;
    foundConnector.settings = {
        scriptSel: scriptSel.id,
        scriptRun: scriptRun.id,
        startParam: customConnector.id,
        hasDocumentation: false
    }
}

foundConnector.name = connectorName + customConnector.name;
foundConnector.description = "Auto created from Neptune Extended Connectors";
foundConnector.updatedAt = new Date();
foundConnector.changedBy = req.user.username;

await manager.save('connector', foundConnector);

result.data = customConnector;
complete();
