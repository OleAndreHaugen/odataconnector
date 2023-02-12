const XMLParser = modules.xml2js;

const Service = req.query.service; //"FAR_CUSTOMER_LINE_ITEMS";
const EntitySet = req.query.entitySet; // "Items";

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
    let annotations = metaJson["edmx:Edmx"]["edmx:DataServices"].Schema.Annotations;

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
            // field.VH = property["sap:value-list"];

            const annotation = annotations.find(annotations => annotations.Target === valueListTarget);

            if (annotation) {
                const collectionPath = annotation.Annotation.Record.PropertyValue.find(value => value.Property === "CollectionPath");
                field.collectionPath = collectionPath.String;

                // const entitySet = entitySets.find(entitySets => entitySets.Name === field.collectionPath);
                // const entityTypeName = entitySet.EntityType.split(".");
                // const entityType = entityTypes.find(entityTypes => entityTypes.Name === entityTypeName[entityTypeName.length - 1]);
                // field.entityType = entityType.Property;


                // SINGLE VS MULTI

                // if (!valueHelp[field.collectionPath]) {

                // const vhOptions = {
                //     service: Service,
                //     entitySet: field.collectionPath,
                //     parameters: {
                //         "$format": "json",
                //     }
                // }

                // const resItems = await apis.get(vhOptions);
                // valueHelp[field.collectionPath] = resItems.data.d.results.map(function (item) {
                //     return {
                //         key: item[field.name],
                //         text: item[field.name + "Name"]
                //     }
                // });

                // }

                // CollectionPath 
                // Fields 

                //     field.items = valueHelp[field.collectionPath];

            }

        }

        fields.push(field);

    }

    result.data = fields.sort(sortByProperty("label"));
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

