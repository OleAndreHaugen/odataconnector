const XMLParser = modules.xml2js;
const Service = req.query.service;

const SystemId = req.query.systemid;
const SystemUrl = "/sap/opu/odata/sap/" + Service + "/$metadata";

const EntitySets = [];

try {

    const res = await globals.Utils.RequestHandler(SystemUrl, SystemId, "xml");

    const metaJson = await XMLParser.parseStringPromise(res.data, {
        explicitArray: false,
        mergeAttrs: true
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
        }

        if (entitySet["sap:creatable"] && entitySet["sap:creatable"] === "false") entityData.creatable = false;
        if (entitySet["sap:updatable"] && entitySet["sap:updatable"] === "false") entityData.updatable = false;
        if (entitySet["sap:deletable"] && entitySet["sap:deletable"] === "false") entityData.deletable = false;

        EntitySets.push(entityData)

    }

    result.data = EntitySets.sort(globals.Utils.SortBy("name"));
    complete();

} catch (error) {
    log.error("Error in request: ", error);
    complete();
}
