const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "documents", "food-paradise-menu.pdf");
const pageWidth = 595.28;
const pageHeight = 841.89;
const images = {};
const imageLabels = {
  "restaurant-hero.jpg": "Hero",
  "restaurant-interior.jpg": "Interior",
  "biryani.jpg": "Biryani",
  "pasta.jpg": "Pasta",
  "pizza.jpg": "Pizza",
  "burger.jpg": "Burger",
  "dessert.jpg": "Dessert",
};
const objects = [null];

function addObject(value) {
  objects.push(Buffer.isBuffer(value) ? value : Buffer.from(value, "ascii"));
  return objects.length - 1;
}

function setObject(id, value) {
  objects[id] = Buffer.isBuffer(value) ? value : Buffer.from(value, "ascii");
}

function pdfString(value) {
  return value.replace(/[\\()]/g, "\\$&");
}

function color(hex) {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16) / 255);
  return channels.map((channel) => channel.toFixed(3)).join(" ");
}

function text(x, top, size, value, font = "F1", fill = "#29251f") {
  const baseline = pageHeight - top - size;
  return `BT /${font} ${size} Tf ${color(fill)} rg 1 0 0 1 ${x.toFixed(2)} ${baseline.toFixed(2)} Tm (${pdfString(value)}) Tj ET\n`;
}

function rectangle(x, top, width, height, fill) {
  const y = pageHeight - top - height;
  return `q ${color(fill)} rg ${x} ${y.toFixed(2)} ${width} ${height} re f Q\n`;
}

function rule(x1, top, x2, fill = "#e8dfd1", thickness = 0.7) {
  const y = pageHeight - top;
  return `q ${color(fill)} RG ${thickness} w ${x1} ${y.toFixed(2)} m ${x2} ${y.toFixed(2)} l S Q\n`;
}

function jpegDimensions(buffer) {
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }

    offset += 2 + buffer.readUInt16BE(offset + 2);
  }
  throw new Error("Unable to read JPEG dimensions.");
}

function registerImage(fileName) {
  if (images[fileName]) return images[fileName];

  const data = fs.readFileSync(path.join(root, "images", fileName));
  const dimensions = jpegDimensions(data);
  const objectId = addObject(Buffer.concat([
    Buffer.from(
      `<< /Type /XObject /Subtype /Image /Width ${dimensions.width} /Height ${dimensions.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${data.length} >>\nstream\n`,
      "ascii",
    ),
    data,
    Buffer.from("\nendstream", "ascii"),
  ]));

  images[fileName] = { objectId, ...dimensions };
  return images[fileName];
}

function drawImage(fileName, x, top, width, height, label) {
  const image = registerImage(fileName);
  const scale = Math.max(width / image.width, height / image.height);
  const drawnWidth = image.width * scale;
  const drawnHeight = image.height * scale;
  const left = x + (width - drawnWidth) / 2;
  const bottom = pageHeight - top - height + (height - drawnHeight) / 2;
  return `q ${x} ${(pageHeight - top - height).toFixed(2)} ${width} ${height} re W n ${drawnWidth.toFixed(2)} 0 0 ${drawnHeight.toFixed(2)} ${left.toFixed(2)} ${bottom.toFixed(2)} cm /${label} Do Q\n`;
}

function wrap(value, maxChars) {
  const lines = [];
  let line = "";
  for (const word of value.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function category(x, top, width, title, dishes) {
  let content = text(x, top, 10, title.toUpperCase(), "F2", "#a84725");
  content += rule(x, top + 20, x + width, "#d7a64b", 1.1);
  let rowTop = top + 29;

  for (const dish of dishes) {
    content += text(x, rowTop, 12, dish.name, "F2", "#29251f");
    const priceX = x + width - dish.price.length * 6.1;
    content += text(priceX, rowTop, 10, dish.price, "F2", "#a84725");
    const lines = wrap(dish.description, Math.floor(width / 4.5)).slice(0, 2);
    lines.forEach((line, index) => {
      content += text(x, rowTop + 16 + index * 11, 8.5, line, "F1", "#756e63");
    });
    rowTop += lines.length > 1 ? 59 : 51;
    content += rule(x, rowTop - 7, x + width, "#e8dfd1", 0.5);
  }
  return content;
}

function pageHeader(title, subtitle, pageNumber) {
  let content = rectangle(0, 0, pageWidth, pageHeight, "#fffdf8");
  content += text(42, 34, 10, "FOOD PARADISE", "F2", "#a84725");
  content += text(42, 50, 25, title, "F3", "#29251f");
  content += text(42, 84, 9, subtitle, "F1", "#756e63");
  content += rule(42, 112, 553, "#e8dfd1", 0.8);
  content += text(42, 805, 8, "Fresh flavours, happy moments.  |  Prices in Rs.", "F1", "#756e63");
  content += text(526, 805, 8, String(pageNumber).padStart(2, "0"), "F2", "#a84725");
  return content;
}

function heroPage() {
  let content = rectangle(0, 0, pageWidth, pageHeight, "#fffdf8");
  content += rectangle(38, 38, 519, 174, "#302b25");
  content += drawImage("restaurant-hero.jpg", 363, 38, 194, 174, "Hero");
  content += rectangle(38, 38, 4, 174, "#d7a64b");
  content += text(61, 64, 10, "GOOD FOOD. GREAT COMPANY.", "F2", "#e7bb67");
  content += text(61, 94, 29, "FOOD PARADISE", "F3", "#fffdf8");
  content += text(61, 132, 21, "OUR MENU", "F2", "#fffdf8");
  content += text(61, 169, 9, "Fresh flavours, happy moments.", "F1", "#eee1ce");
  content += text(42, 237, 9, "MADE FRESH, SERVED WITH CARE", "F2", "#a84725");
  content += category(42, 270, 239, "Starters", [
    { name: "Garden Fresh Salad", description: "Crisp seasonal greens, colourful vegetables and a lively house dressing.", price: "Rs. 150" },
    { name: "Kitchen Sharing Platter", description: "Fresh kitchen favourites served with our tangy signature dip.", price: "Rs. 180" },
  ]);
  content += category(314, 270, 239, "Main Course", [
    { name: "Paradise Biryani", description: "Fragrant basmati rice, warming spices and fresh herbs in every forkful.", price: "Rs. 280" },
    { name: "Herb Garden Pasta", description: "Tender pasta tossed with a rich, comforting sauce and fragrant herbs.", price: "Rs. 260" },
  ]);
  content += text(42, 635, 9, "FROM OUR TABLE TO YOURS", "F2", "#a84725");
  content += drawImage("restaurant-interior.jpg", 42, 658, 158, 109, "Interior");
  content += drawImage("biryani.jpg", 218, 658, 158, 109, "Biryani");
  content += drawImage("pasta.jpg", 394, 658, 159, 109, "Pasta");
  content += rule(42, 783, 553, "#e8dfd1", 0.8);
  content += text(42, 797, 8, "Food Paradise  |  A warm welcome, every time.", "F1", "#756e63");
  content += text(526, 797, 8, "01", "F2", "#a84725");
  return content;
}

function continuationPage() {
  let content = pageHeader("More to love", "A few guest favourites, from the oven to the sweetest finish.", 2);
  content += category(42, 145, 239, "Pizza and Burgers", [
    { name: "Garden Pizza", description: "Crisp golden base, rich tomato sauce and plenty of fresh toppings.", price: "Rs. 320" },
    { name: "Classic House Burger", description: "Juicy patty layered with crisp greens in a soft toasted bun.", price: "Rs. 220" },
  ]);
  content += category(314, 145, 239, "Desserts", [
    { name: "Chocolate Fudge", description: "Rich chocolate goodness with a smooth, indulgent finish.", price: "Rs. 160" },
  ]);
  content += category(314, 305, 239, "Beverages", [
    { name: "Fresh Citrus Cooler", description: "A bright, refreshing citrus drink poured over ice.", price: "Rs. 120" },
  ]);
  content += text(42, 415, 9, "GOOD THINGS ARE BETTER SHARED", "F2", "#a84725");
  content += drawImage("pizza.jpg", 42, 440, 158, 174, "Pizza");
  content += drawImage("burger.jpg", 218, 440, 158, 174, "Burger");
  content += drawImage("dessert.jpg", 394, 440, 159, 174, "Dessert");
  content += rectangle(42, 652, 511, 92, "#f2eadc");
  content += text(61, 671, 14, "Come as you are. Leave a little happier.", "F3", "#29251f");
  content += text(61, 698, 9, "Ask our team about ingredients or dietary requirements.", "F1", "#756e63");
  content += text(61, 719, 9, "Thank you for sharing a meal with Food Paradise.", "F1", "#756e63");
  return content;
}

const catalogId = addObject("");
const pagesId = addObject("");
const regularFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
const boldFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
const titleFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>");

const pageDefinitions = [
  {
    content: heroPage(),
    images: ["restaurant-hero.jpg", "restaurant-interior.jpg", "biryani.jpg", "pasta.jpg"],
  },
  {
    content: continuationPage(),
    images: ["pizza.jpg", "burger.jpg", "dessert.jpg"],
  },
];

const pageIds = [];
for (const definition of pageDefinitions) {
  const resources = {};
  for (const name of definition.images) resources[name] = registerImage(name);
  const xObjects = Object.entries(resources)
    .map(([name, image]) => `/${imageLabels[name]} ${image.objectId} 0 R`)
    .join(" ");
  const contentBytes = Buffer.from(definition.content, "ascii");
  const contentId = addObject(Buffer.concat([
    Buffer.from(`<< /Length ${contentBytes.length} >>\nstream\n`, "ascii"),
    contentBytes,
    Buffer.from("endstream", "ascii"),
  ]));
  const pageId = addObject(
    `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
    `/Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R /F3 ${titleFontId} 0 R >> ` +
    `/XObject << ${xObjects} >> >> /Contents ${contentId} 0 R >>`,
  );
  pageIds.push(pageId);
}

setObject(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
setObject(pagesId, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
const infoId = addObject("<< /Title (Food Paradise Menu) /Author (Food Paradise) /Subject (Restaurant menu) >>");

const chunks = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "binary")];
const offsets = [0];
let length = chunks[0].length;

for (let id = 1; id < objects.length; id += 1) {
  offsets[id] = length;
  const entry = Buffer.concat([
    Buffer.from(`${id} 0 obj\n`, "ascii"),
    objects[id],
    Buffer.from("\nendobj\n", "ascii"),
  ]);
  chunks.push(entry);
  length += entry.length;
}

const xrefOffset = length;
let xref = `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
for (let id = 1; id < objects.length; id += 1) {
  xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
}
xref += `trailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
chunks.push(Buffer.from(xref, "ascii"));

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, Buffer.concat(chunks));
console.log(`Created ${path.relative(root, output)} (${fs.statSync(output).size} bytes).`);
