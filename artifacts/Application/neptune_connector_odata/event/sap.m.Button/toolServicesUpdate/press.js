apiGetServices().then(function (res) {
    modeltabServices.setData(res);
    diaServices.setTitle("OData Services (" + res.length + ")");
});
