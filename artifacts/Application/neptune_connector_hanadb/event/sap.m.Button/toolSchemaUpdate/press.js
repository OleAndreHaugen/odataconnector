diaSchema.setBusy(true);

apiGetSchema({
    parameters: {
        dbid: modeloPageDetail.oData.systemid,
    },
}).then(function (res) {
    diaSchema.setBusy(false);

    if (res.error) {
        sap.m.MessageToast.show(res.error);
    } else {
        modeltabSchema.setData(res);
        diaSchema.setTitle("HANA DB Schemas (" + res.length + ")");
    }
});
