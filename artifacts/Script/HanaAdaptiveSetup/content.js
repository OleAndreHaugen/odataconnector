let fieldCatalog = [];
let columns = [];

// Get Connector
const connector = await entities.neptune_af_connector.findOne({
    select: ["config"],
    where: { id: req.body._connector.settings.startParam }
});

if (!connector) return complete();

for (let i = 0; i < connector.config.fields.length; i++) {

    const field = connector.config.fields[i];

    if (field.sel) {

        let usage = "BOTH";
        let type = "string";
        let items = [];

        // Type
        switch (field.type) {

            case "BOOLEAN":
                type = "boolean";
                break;

            default:
                break;

        }

        fieldCatalog.push({
            name: field.name,
            label: field.label,
            type: type,
            usage: usage,
            items: items
        });

        // Joins
        if (field.joinTable && field.joinField && field.joinFields) {

            field.joinFields.forEach(function (joinField) {
                if (joinField.sel) {
                    fieldCatalog.push({
                        name: field.joinTable + "." + joinField.name,
                        label: joinField.label,
                        type: joinField.type,
                        usage: "BOTH"
                    });
                }
            })

        }

    }

}

result.data = fieldCatalog.sort(globals.Utils.SortBy("name"));
complete();
