const XMLParser = modules.xml2js;

const Service = req.query.service;
const EntitySet = req.query.entitySet;

let fields = [];

try {

    const res = await apis.metadata({
        service: Service,
    });

    const metaJson = await XMLParser.parseStringPromise(res.data, {
        explicitArray: false,
        mergeAttrs: true
    });

    let entitySets = metaJson["edmx:Edmx"]["edmx:DataServices"].Schema.EntityContainer.EntitySet;
    let entityTypes = metaJson["edmx:Edmx"]["edmx:DataServices"].Schema.EntityType;

    const entitySet = entitySets.find(entitySets => entitySets.Name === EntitySet);
    const entityTypeName = entitySet.EntityType.split(".");
    const entityType = entityTypes.find(entityTypes => entityTypes.Name === entityTypeName[entityTypeName.length - 1]);

    // Fields
    for (iProp = 0; iProp < entityType.Property.length; iProp++) {

        const property = entityType.Property[iProp];

        const field = {
            type: property.Type.split(".")[1].toLowerCase(),
            name: property.Name,
            label: property["sap:label"],
        }

        // Value Help
        if (property["sap:value-list"]) {
            const valueListTarget = entitySet.EntityType + "/" + property.Name;
            field.valueListTarget = valueListTarget;
        }

        fields.push(field);

    }

    result.data = {
        fields: fields.sort(sortByProperty("label")),
        metadata: metaJson
    }

    complete();

} catch (error) {
    log.error("Error in request: ", error);
    complete();
}


function sortByProperty(property) {
    return function (a, b) {
        if (a[property] > b[property])
            return 1;
        else if (a[property] < b[property])
            return -1;

        return 0;
    }
}

