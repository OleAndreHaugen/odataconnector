// const metadata = await globals.Utils.RequestHandler("29c0b5b2-df23-4489-aad0-904389c86308");
// console.log(metadata);
// complete();
let services = [];

try {

    const url = "/sap/opu/odata/IWFND/CATALOGSERVICE;v=2/ServiceCollection?$format=json";

    const res = await globals.Utils.RequestHandler(url, "29c0b5b2-df23-4489-aad0-904389c86308");

    console.log(res.headers)

    for (i = 0; i < res.data.d.results.length; i++) {

        const service = res.data.d.results[i];

        services.push({
            title: service.Title,
            description: service.Description,
            author: service.Author,
        })

    }

console.log(services)
    result.data = services;
    complete();
} catch (error) {
    log.error("Error in request: ", error);
    return fail();
}