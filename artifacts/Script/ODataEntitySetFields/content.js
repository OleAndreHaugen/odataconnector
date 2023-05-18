const XMLParser = modules.xml2js;
const Service = req.query.service;
const EntitySet = req.query.entitySet;

const SystemId = req.query.systemid;
const SystemUrl =
    (req.query.source === "xsodata"
        ? "/xsodata/v0/" + Service + ".xsodata"
        : "/sap/opu/odata/sap/" + Service) + "/$metadata";

let fields = [];

try {
    // Check if xml2js is installed
    if (!XMLParser) {
        result.data = { error: "Missing NPM module xml2js.Please install from NPM Modules" };
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
    let entityTypes = metaJson["edmx:Edmx"]["edmx:DataServices"].Schema.EntityType;

    if (entitySets && !entitySets.length) entitySets = [entitySets];
    if (entityTypes && !entityTypes.length) entityTypes = [entityTypes];

    const entitySet = entitySets.find((entitySets) => entitySets.Name === EntitySet);
    const entityTypeName = entitySet.EntityType.split(".");
    const entityType = entityTypes.find(
        (entityTypes) => entityTypes.Name === entityTypeName[entityTypeName.length - 1]
    );

    // Fields
    for (let iProp = 0; iProp < entityType.Property.length; iProp++) {
        const property = entityType.Property[iProp];

        const field = {
            type: property.Type.split(".")[1].toLowerCase(),
            name: property.Name,
            label: property["sap:label"] ? property["sap:label"] : property.Name,
        };

        // Value Help
        if (property["sap:value-list"]) {
            const valueListTarget = entitySet.EntityType + "/" + property.Name;
            field.valueListTarget = valueListTarget;
        }

        fields.push(field);
    }

    result.data = {
        fields: fields.sort(globals.Utils.SortBy("label")),
        metadata: metaJson,
    };

    complete();
} catch (error) {
    log.error("Error in request: ", error);
    complete();
}
