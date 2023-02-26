let entities = [];

try {

    const connection = modules.typeorm.getConnection();

    connection.entityMetadatas.forEach(function (entity, i) {
        if (entity.tableType === "regular") {
            entities.push({
                name: entity.tableName,
            })
        }
    })

    result.data = entities.sort(globals.Utils.SortBy("name"));
    complete();

} catch (error) {
    log.error("Error in request: ", error);
    return fail();
}

