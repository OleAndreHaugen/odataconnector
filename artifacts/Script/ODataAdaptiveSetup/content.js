let fieldCatalog = [];

const connector = await entities.neptune_af_connector.findOne({
    select: ["config"],
    where: { id: req.body._connector.settings.startParam }
});

if (!connector) return complete();

for (let i = 0; i < connector.config.fields.length; i++) {

    const field = connector.config.fields[i];

    if (field.sel) {
        fieldCatalog.push({
            type: (field.type === "datetime" ? "timestamp" : field.type),
            name: field.name,
            label: field.label,
            usage: "BOTH",
            valueListTarget: field.valueListTarget
        })
    }

}

result.data = fieldCatalog.sort(globals.Utils.SortBy("name"));
complete();