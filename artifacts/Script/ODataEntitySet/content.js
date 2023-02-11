const XMLParser = modules.xml2js;

const Service = req.query.service;
const EntitySets = [];

try {

    const res = await apis.metadata({
        service: Service,
    });

    const metaJson = await XMLParser.parseStringPromise(res.data, {
        explicitArray: false,
        mergeAttrs: true
    });


    let entitySets = metaJson["edmx:Edmx"]["edmx:DataServices"].Schema.EntityContainer.EntitySet;

    for (i = 0; i < entitySets.length; i++) {

        const entitySet = entitySets[i];

        EntitySets.push({
            name: entitySet.Name,
        })

    }

    result.data = EntitySets.sort(sortByProperty("name"));
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

