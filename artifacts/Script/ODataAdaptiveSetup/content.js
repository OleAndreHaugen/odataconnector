let fieldCatalog = [];

const connector = await entities.neptune_af_connector.findOne({
    select: ["config"],
    where: {
        id: req.body._connector.settings.startParam
    }
});

if (!connector) return complete();


for (i = 0; i < connector.config.fields.length; i++) {
    const field = connector.config.fields[i];


    if (field.sel) {
        fieldCatalog.push({
            type: (field.type === "datetime" ? "timestamp" : field.type),
            name: field.name,
            label: field.label,
            usage: "BOTH",
        })
    }

}

result.data = fieldCatalog.sort(sortByProperty("name"));
complete();


// const XMLParser = modules.xml2js;


// /*

// TODO 

// Move metadata fetching to connector -> Update DB Table
// Select fields in the connector, and fetch it here

// metadata json 

// fields for Adaptive Designer
// valuehelps with entitySet + fields

// new type in Selection Fields - ValueHelp oData - Single/Multi Select options - ONLY if field is from ODATA ? 

// */


// // TEST
// const Service = "FAR_CUSTOMER_LINE_ITEMS";
// const EntitySet = "Items";

// // const Service = "API_BUSINESS_PARTNER";
// // const EntitySet = "A_BusinessPartner";

// let fieldCat = [];
// let valueHelp = {};

// try {

//     const res = await apis.metadata({
//         service: Service,
//     });

//     const metaJson = await XMLParser.parseStringPromise(res.data, {
//         explicitArray: false,
//         mergeAttrs: true
//     });


//     let entitySets = metaJson["edmx:Edmx"]["edmx:DataServices"].Schema.EntityContainer.EntitySet;
//     let entityTypes = metaJson["edmx:Edmx"]["edmx:DataServices"].Schema.EntityType;
//     let annotations = metaJson["edmx:Edmx"]["edmx:DataServices"].Schema.Annotations;

//     // TODO - Only 1
//     for (i = 0; i < entitySets.length; i++) {

//         const entitySet = entitySets[i];

//         if (EntitySet && EntitySet !== entitySet.Name) continue;

//         const entityTypeName = entitySet.EntityType.split(".");
//         const entityType = entityTypes.find(entityTypes => entityTypes.Name === entityTypeName[entityTypeName.length - 1]);


//         for (iProp = 0; iProp < entityType.Property.length; iProp++) {

//             const property = entityType.Property[iProp];

//             const field = {
//                 type: property.Type.split(".")[1].toLowerCase(),
//                 name: property.Name,
//                 label: property["sap:label"],
//                 usage: "BOTH",
//                 // items: []
//             }

//             // Value Help
//             if (property["sap:value-list"]) {

//                 field.valueListTarget = entitySet.EntityType + "/" + property.Name;
//                 // field.VH = property["sap:value-list"];

//                 const annotation = annotations.find(annotations => annotations.Target === field.valueListTarget);

//                 if (annotation) {
//                     const collectionPath = annotation.Annotation.Record.PropertyValue.find(value => value.Property === "CollectionPath");
//                     field.collectionPath = collectionPath.String;

//                     const entitySet = entitySets.find(entitySets => entitySets.Name === field.collectionPath);
//                     const entityTypeName = entitySet.EntityType.split(".");
//                     const entityType = entityTypes.find(entityTypes => entityTypes.Name === entityTypeName[entityTypeName.length - 1]);
//                     field.entityType = entityType.Property;


//                     // SINGLE VS MULTI

//                     // if (!valueHelp[field.collectionPath]) {

//                     // const vhOptions = {
//                     //     service: Service,
//                     //     entitySet: field.collectionPath,
//                     //     parameters: {
//                     //         "$format": "json",
//                     //     }
//                     // }

//                     // const resItems = await apis.get(vhOptions);
//                     // valueHelp[field.collectionPath] = resItems.data.d.results.map(function (item) {
//                     //     return {
//                     //         key: item[field.name],
//                     //         text: item[field.name + "Name"]
//                     //     }
//                     // });

//                     // }

//                     // CollectionPath 
//                     // Fields 

//                     field.items = valueHelp[field.collectionPath];

//                 }

//             }

//             fieldCat.push(field);

//         }

//     }

//     result.data = fieldCat.sort(sortByProperty("name"));

//     // result.data = {
//     //     fieldCat: fieldCat.sort(sortByProperty("name")),
//     //     annotations: annotations
//     // }
//     complete();

// } catch (error) {
//     log.error("Error in request: ", error);
//     complete();
// }


function sortByProperty(property) {
    return function (a, b) {
        if (a[property] > b[property])
            return 1;
        else if (a[property] < b[property])
            return -1;

        return 0;
    }
}

