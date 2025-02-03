// ID for Table: neptune_af_connector_dburi
const id = "BB5D0142-B1A0-4F53-B3BE-E6AFFBE1D014";

const opts = {
    body: { id: id },
};

try {
    // Get the Table Defintion
    const response = await apis.Get(opts);

    // Map fields to what the Connector Server Script expects
    const fieldCatalog = response.data.fields.map((f) => {
        return {
            name: f.fieldName,
            type: f.fieldType,
            label: f.description,
            usage: "BOTH",
        };
    });

    result.data = fieldCatalog;
    complete();

} catch (error) {
    log.error("Error in request: ", error);
    return fail();
}
