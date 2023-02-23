const manager = modules.typeorm.getConnection().manager;

const customConnector = await entities.neptune_af_connector.save(req.body);

// Find Existing Connecors in the System
const systemConnectors = await manager.find('connector', {
    where: { type: "S", disabled: false }
});

let foundConnector = {};

for (i = 0; i < systemConnectors.length; i++) {
    const systemConnector = systemConnectors[i];
    if (systemConnector.settings && systemConnector.settings.startParam === customConnector.id) {
        foundConnector = systemConnector;
    }
}

// Auto Create Connector
if (!foundConnector.id) {
    foundConnector.name = "OData: " + customConnector.name;
    foundConnector.description = customConnector.description || "";
    foundConnector.type = "S";
    foundConnector.disabled = false;
    foundConnector.createdAt = new Date();
    foundConnector.createdBy = req.user.username;
    foundConnector.settings = {
        scriptSel: '82c9459e-bc38-4df9-98d3-080bcda58b22',
        scriptRun: '4a64df7b-bce9-482c-92f4-b0a8054ea75b',
        startParam: customConnector.id,
        hasDocumentation: false
    }
} else {
    foundConnector.name = "OData: " + customConnector.name;
    foundConnector.description = customConnector.description;
}

foundConnector.updatedAt = new Date();
foundConnector.changedBy = req.user.username;

await manager.save('connector', foundConnector);

result.data = customConnector;
complete();
