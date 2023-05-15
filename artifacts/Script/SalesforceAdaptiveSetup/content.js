let fieldCatalog = [];
let metadata = {};

// Get Connector
const connector = await entities.neptune_af_connector.findOne({
    select: ["config", "systemid"],
    where: { id: req.body._connector.settings.startParam }
});

if (!connector) return complete();

for (let i = 0; i < connector.config.fields.length; i++) {

    const field = connector.config.fields[i];

    if (field.sel) {

        // Get Field Metadata 
        // const fieldMeta = await getFieldMeta(field);

        let usage = "OUTPUT";
        let type = "string";
        let items = [];

        // Type
        switch (field.type) {

            case "boolean":
                type = "boolean";
                break;

            case "datetime":
                type = "timestamp";
                break;

            default:
                break;

        }

        // Usage
        if (field.filterable) usage = "BOTH";

        // Items 
        if (field.picklistValues) {
            field.picklistValues.forEach(function (field) {
                items.push({
                    key: field.value,
                    text: field.label
                })
            })
        }

        // Items - DateTimeStamp
        if (field.type === "datetime") {
            items.push({ key: "YESTERDAY", text: "Yesterday" });
            items.push({ key: "TODAY", text: "Today" });
            items.push({ key: "TOMORROW", text: "Tomorrow" });
            items.push({ key: "LAST_WEEK", text: "Last Week" });
            items.push({ key: "THIS_WEEK", text: "This Week" });
            items.push({ key: "NEXT_WEEK", text: "Next Week" });
            items.push({ key: "LAST_MONTH", text: "Last Month" });
            items.push({ key: "THIS_MONTH", text: "This Month" });
            items.push({ key: "NEXT_MONTH", text: "Next Month" });
            items.push({ key: "LAST_90_DAYS", text: "Last 90 Days" });
            items.push({ key: "NEXT_90_DAYS", text: "Next 90 Days" });
            items.push({ key: "THIS_QUARTER", text: "This Quarter" });
            items.push({ key: "LAST_QUARTER", text: "Last Quarter" });
            items.push({ key: "NEXT_QUARTER", text: "Next Quarter" });
            items.push({ key: "THIS_YEAR", text: "This Year" });
            items.push({ key: "LAST_YEAR", text: "Last Year" });
            items.push({ key: "NEXT_YEAR", text: "Next Year" });
        }

        fieldCatalog.push({
            name: field.name,
            label: field.label,
            type: type,
            usage: usage,
            items: items
        });

    }

}

result.data = fieldCatalog.sort(globals.Utils.SortBy("name"));
complete();
