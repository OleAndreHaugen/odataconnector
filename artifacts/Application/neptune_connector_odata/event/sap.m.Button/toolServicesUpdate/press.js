apiGetServices({
    parameters: {
        systemid: modeloPageDetail.oData.systemid,
    },
}).then(function (res) {
    modeltabServices.setData(res);
    diaServices.setTitle("OData Services (" + res.length + ")");
});
