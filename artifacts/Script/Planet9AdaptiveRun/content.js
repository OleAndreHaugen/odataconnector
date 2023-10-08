const { In, Like } = operators;

// Get Connector
const connector = await entities.neptune_af_connector.findOne({
    select: ["config"],
    where: { id: req.body._connector.settings.startParam },
});

if (!connector) return complete();

const manager = p9.manager ? p9.manager : modules.typeorm.getConnection().manager;

try {
    // Process Method
    switch (req.query.method) {
        case "Delete":
            processDelete();
            break;

        case "Save":
            processSave();
            break;

        case "Get":
            processGet();
            break;

        default:
            processList();
            break;
    }
} catch (e) {
    result.data = {
        status: "ERROR",
        message: e,
    };

    complete();
}

async function processDelete() {
    result.data = {
        status: "ERROR",
        message: {
            type: "error",
            text: "Delete not supported. Please use Cockpit",
        },
    };

    complete();
}

async function processGet() {
    let options = {
        select: ["id"],
        where: {},
    };

    //  Fields Selection
    if (req.body._settings.fieldsSel) {
        req.body._settings.fieldsSel.forEach(function (field) {
            options.select.push(field.name);
        });
    }

    // Where
    if (req.body._keyField) {
        req.body._keyField.forEach(function (keyField) {
            options.where[keyField.fieldName] = req.body[keyField.fieldName];
        });
    }

    if (req.body["id"]) options.where["id"] = req.body["id"];

    // Query Table
    const data = await manager.find(connector.config.table, options);

    result.data = data;
    complete();
}

async function processList() {
    let options = {
        select: ["id"],
        where: {},
    };

    // Where
    const bodyFields = Object.keys(req.body);

    bodyFields.forEach(function (fieldName) {
        if (fieldName.substr(0, 1) === "_") return;

        const fieldValue = req.body[fieldName];
        if (!fieldValue) return;

        const fieldSel = req.body._settings.fieldsSel.find((f) => f.name === fieldName);
        if (!fieldSel) return;

        switch (fieldSel.type) {
            case "CheckBox":
            case "Switch":
            case "SingleSelect":
            case "SingleSelectLookup":
            case "SingleSelectScript":
                options.where[fieldName] = fieldValue;
                break;

            case "MultiSelect":
            case "MultiSelectLookup":
            case "MultiSelectScript":
                options.where[fieldName] = In(fieldValue);
                break;

            default:
                options.where[fieldName] = Like("%" + fieldValue + "%");
                break;
        }
    });

    // Count
    const dataCount = await manager.count(connector.config.table, options);

    // Selected Fields
    if (req.body._settings.fieldsRun) {
        req.body._settings.fieldsRun.forEach(function (field) {
            options.select.push(field.name);
        });
    } else {
        return { error: "No fields to display in table" };
    }

    // Sorting
    if (req.body._order) options.order = req.body._order;

    // pagination
    if (req.body._pagination) {
        options.take = req.body._pagination.take;
        options.skip = req.body._pagination.skip;
    }

    // options.relations = ['roles'];

    // Query Table
    const data = await manager.find(connector.config.table, options);

    result.data = {
        count: dataCount,
        result: data,
        debug: options,
    };

    complete();
}

async function processSave() {
    let options = {
        where: {},
    };

    if (req.body["id"]) {
        options.where["id"] = req.body["id"];

        // Get Existing Record
        let dataRec = await manager.findOne(connector.config.table, options);

        // Merge Data from Form
        req.body._settings.fieldsSel.forEach(function (field) {
            if (field.editable) dataRec[field.name] = req.body[field.name];
        });

        // Query Table
        const dataSaved = await manager.save(connector.config.table, dataRec);
        result.data = dataSaved;
    } else {
        result.data = {
            status: "ERROR",
            message: {
                type: "error",
                text: "Create not supported. Please use Cockpit",
            },
        };
    }

    complete();
}
