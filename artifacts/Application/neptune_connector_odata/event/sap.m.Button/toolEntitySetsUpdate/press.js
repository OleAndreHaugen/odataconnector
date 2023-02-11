apiGetEntitySets({
    parameters: {
        service: modeloPageDetail.oData.config.service,
    },
}).then(function (res) {
    modeltabEntitySets.setData(res);
    diaEntitySets.setTitle("OData Entity Sets (" + res.length + ")");
});
