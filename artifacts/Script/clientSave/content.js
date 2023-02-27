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

    case "servicenow":
        connectorName = "ServiceNow: ";
        connectorScriptSel = "59d2898d-fed6-42c4-8c20-6f608f8d08a1";
        connectorScriptRun = "2a0e920e-225d-43f6-879a-962216222afe";
        break;

    case "planet9":
        connectorName = "Open Edition: ";
        connectorScriptSel = "6ddd1b3b-6f87-4a07-8200-2bed82af1369";
        connectorScriptRun = "482e0e79-92b0-4fff-8d88-3b501c655d71";
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
if (scriptSel && scriptRun) {
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
    foundConnector.ver = new Date();

    await manager.save('connector', foundConnector);

}

result.data = customConnector;
complete();
