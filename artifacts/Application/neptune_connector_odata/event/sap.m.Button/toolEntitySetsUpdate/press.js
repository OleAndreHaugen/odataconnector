apiGetEntitySets({
    parameters: {
        systemid: modeloPageDetail.oData.systemid,
        service: modeloPageDetail.oData.config.service,
        source: modeloPageDetail.oData.config.source,
    },
}).then(function (res) {
    if (res.error) {
        sap.m.MessageToast.show(res.error);
    } else {
        modeltabEntitySets.setData(res);
        diaEntitySets.setTitle("OData Entity Sets (" + res.length + ")");
    }
});
