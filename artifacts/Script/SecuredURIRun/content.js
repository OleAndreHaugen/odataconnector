
// Decrypting text
const PWD_PLACEHOLDER = "********";

try {
    // Process Method
    switch (req.query.method) {
        case "Delete":
            processDelete();
            break;

        case "Save":
            await processSave();
            break;

        case "Get":
            await processGet();
            break;

        default:
            await processList();
            break;
    }
} catch (e) {
    result.data = {
        status: "ERROR",
        message: e,
    };

    complete();
}

async function processList() {
    // List should never be called from the NEPTUNE_AF_CONNECTOR_DBURI_DETAIL Adaptive app
    complete();
}

async function processGet() {
    const id = req.body.id;
    const entity = await entities.neptune_af_connector_dburi.findOne(id);
    // Replace the password with the placeholder
    entity.password = PWD_PLACEHOLDER;
    result.data = entity;
    complete();
}

async function processSave() {
    if (req.body.password == PWD_PLACEHOLDER) {
        // If password wasn't changed - don't update it
        delete req.body["password"];
    } else {
        req.body.password = globals.Encryption.encrypt(req.body.password);
    }
    const entity = await entities.neptune_af_connector_dburi.save(req.body);

    result.data = entity;
    complete();
}

async function processDelete() {
    const id = req.body.id;
    await entities.neptune_af_connector_dburi.delete(id);
    complete();
}
