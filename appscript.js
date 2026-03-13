function doPost(e) {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName("Inventory");

  const body = JSON.parse(e.postData.contents);
  const box = String(body.box || "").trim();

  const data = sheet.getRange("A2:B" + sheet.getLastRow()).getValues();

  for (let i = 0; i < data.length; i++) {
    const sheetBox = normalize(data[i][0]);
    const reqBox = normalize(box);

    if (sheetBox === reqBox) {
      const newVal = Math.max(0, Number(data[i][1]) - 1);
      sheet.getRange(i + 2, 2).setValue(newVal);

      return json({ box, remaining: newVal });
    }
  }

  return json({ error: "Box not found", received: box });
}

function normalize(v) {
  return String(v)
    .replace(/[×]/g,"x")
    .replace(/\s+/g,"")
    .toLowerCase();
}

function json(o) {
  return ContentService
    .createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}
