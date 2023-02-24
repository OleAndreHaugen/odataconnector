const SystemId = req.query.systemid;
const SystemUrl = "/services/data/v56.0/sobjects/" + req.query.table + "/describe";

let sobjects = [];
// let metadata;

// Check for system ID
if (!SystemId) {
    result.data = { error: "Please select system" };
    return complete();
}

try {

    // // Fetch from cache
    // let cache = await entities.neptune_af_connector_sf_objects.findOne({
    //     where: {
    //         systemid: req.query.systemid,
    //         table: req.query.table
    //     }
    // })

    // if (!cache || !cache.id) {

    const res = await globals.Utils.RequestHandler(SystemUrl, SystemId, "json");

    if (res.error) {
        result.data = res;
        return complete();
    }

    // metadata = res.data

    // cache = {
    //     systemid: req.query.systemid,
    //     table: req.query.table,
    //     metadata: metadata
    // }

    // await entities.neptune_af_connector_sf_objects.save(cache);

    // } else {
    //     metadata = cache.metadata;
    // }

    result.data = res.data;
    complete();

} catch (error) {
    log.error("Error in request: ", error);
    return fail();
}
