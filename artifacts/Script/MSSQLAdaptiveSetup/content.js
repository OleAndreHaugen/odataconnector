let fieldCatalog = [];

// Get Connector
const connector = await entities.neptune_af_connector.findOne({
    select: ["config", "systemid"],
    where: { id: req.body._connector.settings.startParam },
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
            case "datetime":
                type = "timestamp";
                break;
            case "int":
                type = "integer";
                break;
            case "decimal":
                type = "decimal";
                break;
            case "bit":
                type = "boolean";
                break;
        }

        // ValueList
        if (
            field.valueList &&
            field.valueList.enable &&
            field.valueList.fieldKey &&
            field.valueList.fieldLabel &&
            field.joinTable
        ) {
            const statement = `select ${field.valueList.fieldKey},${field.valueList.fieldLabel} from "${connector.config.schema}"."${field.joinTable}"`;
            const res = await globals.Utils.MSSQLExec(connector.systemid, statement);

            if (!res.error && res.recordset && res.recordset.length) {
                res.recordset.forEach(function (row) {
                    items.push({
                        key: row[field.valueList.fieldKey],
                        text: field.valueList.showKey
                            ? row[field.valueList.fieldKey] +
                              " - " +
                              row[field.valueList.fieldLabel]
                            : row[field.valueList.fieldLabel],
                    });
                });
            }
        }

        fieldCatalog.push({
            name: field.name,
            label: field.label || field.description,
            type: type,
            usage: usage,
            items: items,
        });

        // Joins
        if (field.joinTable && field.joinFields) {
            field.joinFields.forEach(function (joinField) {
                if (joinField.sel) {
                    fieldCatalog.push({
                        name: field.joinTable + "." + joinField.name,
                        label: joinField.label,
                        type: joinField.type,
                        usage: "BOTH",
                    });
                }
            });
        }
    }
}

result.data = fieldCatalog;
complete();
