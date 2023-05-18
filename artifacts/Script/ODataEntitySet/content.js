const XMLParser = modules.xml2js;
const Service = req.query.service;

const SystemId = req.query.systemid;
const SystemUrl =
    (req.query.source === "xsodata"
        ? "/xsodata/v0/" + Service + ".xsodata"
        : "/sap/opu/odata/sap/" + Service) + "/$metadata";

const EntitySets = [];

try {
    // Check if xml2js is installed
    if (!XMLParser) {
        result.data = { error: "Missing NPM module xml2js.Please install from NPM Modules" };
        return complete();
    }

    // Check for SystemId
    if (!SystemId) {
        result.data = { error: "Please select system" };
        return complete();
    }

    // Check for Service
    if (!Service) {
        result.data = { error: "Please select service" };
        return complete();
    }

    const res = await globals.Utils.RequestHandler(SystemUrl, SystemId, "xml");

    if (res.error) {
        result.data = res;
        return complete();
    }

    if (res.message) {
        result.data = { error: res.message };
        return complete();
    }

    const metaJson = await XMLParser.parseStringPromise(res.data, {
        explicitArray: false,
        mergeAttrs: true,
    });

    let entitySets = metaJson["edmx:Edmx"]["edmx:DataServices"].Schema.EntityContainer.EntitySet;

    // If only 1 record is returned
    if (entitySets && !entitySets.length) entitySets = [entitySets];

    for (i = 0; i < entitySets.length; i++) {
        const entitySet = entitySets[i];

        let entityData = {
            name: entitySet.Name,
            creatable: true,
            updatable: true,
            deletable: true,
        };

        if (entitySet["sap:creatable"] && entitySet["sap:creatable"] === "false")
            entityData.creatable = false;
        if (entitySet["sap:updatable"] && entitySet["sap:updatable"] === "false")
            entityData.updatable = false;
        if (entitySet["sap:deletable"] && entitySet["sap:deletable"] === "false")
            entityData.deletable = false;

        EntitySets.push(entityData);
    }

    result.data = EntitySets.sort(globals.Utils.SortBy("name"));
    complete();
} catch (error) {
    log.error("Error in request: ", error);
    complete();
}
