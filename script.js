// TODO jpg: Itemized totals (e.g. count of each item sold from the order )
// TODO jpg: Per person list of all of the items ordered, and who they're from
// TODO jpg: Per vendor list of all of the orders

const ORDER_PRICE_KEY = 'Lineitem price';
const ORDER_ITEM_SKU_KEY = 'Lineitem sku';
const ORDER_NAME_KEY = 'Lineitem name';
const ORDER_QUANTITY_KEY = 'Lineitem quantity';
const ORDER_ID_KEY = 'Order ID'

class VendorEntry {
    constructor(vendorName) {
        this.vendorName = vendorName
        this.items = {};
    }

    calcTotal() {
        let total = 0;
        for (const item in this.items) {
            total += this.items[item].calcTotal();
        }
        return total;
    }

    itemTotal() {
        let total = 0;
        for (const item in this.items) {
            total += this.items[item].itemCount;
        }
        return total;
    }
}


const ITEM_CATEGORY_KEY = 'Categories';
const ITEM_SKU_KEY = 'SKU';
const ITEM_TITLE_KEY = 'Title';
const ITEM_PRICE_KEY = 'Price';
const ITEM_VARIANT_ONE_KEY = 'Option Value 1';
const ITEM_VARIANT_TWO_KEY = 'Option Value 2';
class ItemEntry {
    constructor(rawItemRow) {
        this.itemName = rawItemRow[ITEM_TITLE_KEY];
        this.itemSku = rawItemRow[ITEM_SKU_KEY];
        this.itemPrice = rawItemRow[ITEM_PRICE_KEY];
        this.itemVariantString = rawItemRow[ITEM_VARIANT_ONE_KEY] + rawItemRow[ITEM_VARIANT_TWO_KEY];
        this.vendorName = rawItemRow[ITEM_CATEGORY_KEY];
    }

    getNameWithVariant() {
        return this.itemVariantString != '' ?
            `${this.itemName} (${this.itemVariantString})` :
            `${this.itemName}`;
    }
}


class ItemVendorEntry {
    constructor(item) {
        this.itemCount = 0;
        this.item = item;
    }

    calcTotal() {
        return parseFloat(this.item.itemPrice) * this.itemCount;
    }
}

async function processData() {
    let orderResult = [];
    let inventoryResult = [];

    try {
        [orderResult, inventoryResult] = await getFileData();
    } catch (e) {
        document.querySelector('.output').textContent = e;
        return;
    }
    cleanData(inventoryResult);
    const [vendorTotal, orderInfo] = parseData(orderResult, inventoryResult);
    renderData(vendorTotal, orderInfo);
}

function getFileData() {
    const orderFile = document.querySelector('#orders').files[0];
    const inventoryFile = document.querySelector('#inventory').files[0];

    if (!orderFile || !inventoryFile) {
        throw new Error('Please upload both files before continuing');
    }

    return Promise.all(
        [new Promise(
                (resolve, reject) =>
                Papa.parse(orderFile, {
                    header: true,
                    complete: resolve,
                    error: reject,
                })),
            new Promise(
                (resolve, reject) =>
                Papa.parse(inventoryFile, {
                    header: true,
                    complete: resolve,
                    error: reject,
                }))
        ]
    )
}

function cleanData(inventoryResult) {
    inventoryResult.data.forEach((item, index) => {
        if (item[ITEM_CATEGORY_KEY] == '') {
            item[ITEM_CATEGORY_KEY] = inventoryResult.data[index - 1][ITEM_CATEGORY_KEY];
        }
        if (item[ITEM_TITLE_KEY] == '') {
            item[ITEM_TITLE_KEY] = inventoryResult.data[index - 1][ITEM_TITLE_KEY];
        }
    })
}

/**
    Returns: A map of vendor names to dollar amounts
*/
function parseData(orderResult, inventoryResult) {
    // Step through the inventory and create a map of SKUs to vendors
    const errorDiv = document.querySelector('.errors');
    const itemSkuMap = {};

    inventoryResult.data.forEach((item) => {
        itemSkuMap[item[ITEM_SKU_KEY]] = new ItemEntry(item);
    })

    // Use the map to calculate totals for each vendor, and a readable list per order

    // {[key: string]: VendorEntry}
    const vendorMap = {};

    // {[key: string]: {[key: string]: ItemEntry}}
    const orderMap = {};

    orderResult.data.forEach((rawOrder) => {

        // Build out the vendorMap here
        const item = itemSkuMap[rawOrder[ORDER_ITEM_SKU_KEY]];
        const orderQuantity = parseInt(rawOrder[ORDER_QUANTITY_KEY])
        if (!item) {
            // We have no item information for the item - add it to an error output;
            const errorElem = document.createElement('div');
            errorElem.innerText = `We had some trouble parsing this row: ${JSON.stringify(rawOrder)}`;
            errorDiv.appendChild(errorElem)
            return;
        }

        const vendor = item.vendorName;
        if (!!vendor) {
            if (!(vendor in vendorMap)) {
                vendorMap[vendor] = new VendorEntry(vendor);
            }

            const vendorEntry = vendorMap[vendor];
            if (!(item.itemSku in vendorEntry.items)) {
                vendorEntry.items[item.itemSku] = new ItemVendorEntry(item);
            }
            vendorEntry.items[item.itemSku].itemCount += orderQuantity;
        } else {
            // We have no vendor information for the item - add it to an error output
            const errorElem = document.createElement('div');
            errorElem.innerText = `We had some trouble parsing this vendor: ${item.vendorName}`;
            errorDiv.appendChild(errorElem)
            return;
        }

        // Build out the orderMap here
        if (!(rawOrder[ORDER_ID_KEY] in orderMap)) {
            orderMap[rawOrder[ORDER_ID_KEY]] = {};
        }
        const orderEntry = orderMap[rawOrder[ORDER_ID_KEY]];

        if (!(item.itemSku in orderEntry)) {
            orderEntry[item.itemSku] = new ItemVendorEntry(item);
        }
        orderEntry[item.itemSku].itemCount += orderQuantity;
    })
    return [vendorMap, orderMap];
}

function renderData(vendorTotal, orderInfo) {
    // Output for vendor totals
    // Define the header
    const result = document.querySelector('#result');
    result.innerHTML = '';
    const vendorTable = document.createElement('TABLE');
    const headVendorRow = vendorTable.insertRow();
    headVendorRow.insertCell(0).innerText = 'Vendor';
    headVendorRow.insertCell(1).innerText = 'Quantity';
    headVendorRow.insertCell(2).innerText = 'Total Sales ($)';

    // Display results
    for (let vendor in vendorTotal) {
        const vendorEntry = vendorTotal[vendor];

        const vendorRow = vendorTable.insertRow();
        const vendorCell = vendorRow.insertCell(0);
        const countCell = vendorRow.insertCell(1);
        const totalCell = vendorRow.insertCell(2);

        vendorCell.innerText = vendor;
        countCell.innerText = vendorEntry.itemTotal();
        totalCell.innerText = `$${vendorEntry.calcTotal().toFixed(2)}`;

        // Sub-rows
        for (const item in vendorEntry.items) {
            const itemEntry = vendorEntry.items[item];
            const itemRow = vendorTable.insertRow();
            const itemVendorCell = itemRow.insertCell(0);
            const itemCountCell = itemRow.insertCell(1);
            itemVendorCell.innerText = itemEntry.item.getNameWithVariant();
            itemVendorCell.className = 'sub-item'
            itemCountCell.innerText = itemEntry.itemCount;
        }
    }
    result.appendChild(vendorTable);

    // Output for order totals
    // Define the header
    const orderTable = document.createElement('TABLE');
    const headOrderRow = orderTable.insertRow();
    headOrderRow.insertCell(0).innerText = 'Order Id';
    headOrderRow.insertCell(1).innerText = 'Vendor';
    headOrderRow.insertCell(2).innerText = 'Item';
    headOrderRow.insertCell(3).innerText = 'Quantity';

    for (const order in orderInfo) {
        const orderEntry = orderInfo[order];

        for (const item in orderEntry) {
            const orderItem = orderEntry[item];
            const orderItemRow = orderTable.insertRow();
            const orderIdCell = orderItemRow.insertCell(0);
            const orderVendorCell = orderItemRow.insertCell(1);
            const orderItemNameCell = orderItemRow.insertCell(2);
            const orderItemCountCell = orderItemRow.insertCell(3);

            orderIdCell.innerText = order;
            orderVendorCell.innerText = orderItem.item.vendorName;
            orderItemNameCell.innerText = orderItem.item.getNameWithVariant();
            orderItemCountCell.innerText = orderItem.itemCount;
        }
    }
    result.appendChild(orderTable);
}
