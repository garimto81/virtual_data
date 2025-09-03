// Google Apps Script에 추가해야 할 코드
// 기존 doPost 함수 내의 switch 문에 다음 case를 추가하세요:

case 'updateCameraInfo':
  // 카메라 정보 일괄 업데이트
  var updates = requestData.updates;
  var indexSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Index');
  var updatedCount = 0;
  
  // 각 업데이트 항목 처리
  updates.forEach(function(update) {
    var rowIndex = update.rowIndex;
    
    // J열부터 N열까지 업데이트 (열 인덱스: J=10, K=11, L=12, M=13, N=14)
    indexSheet.getRange(rowIndex, 10).setValue(update.cam); // J열: cam
    indexSheet.getRange(rowIndex, 11).setValue(update.camFile01name); // K열: camFile01name
    indexSheet.getRange(rowIndex, 12).setValue(update.camFile01number); // L열: camFile01number
    indexSheet.getRange(rowIndex, 13).setValue(update.camFile02name); // M열: camFile02name
    indexSheet.getRange(rowIndex, 14).setValue(update.camFile02number); // N열: camFile02number
    
    updatedCount++;
  });
  
  return ContentService.createTextOutput(JSON.stringify({
    status: 'success',
    message: '카메라 정보 업데이트 완료',
    updated: updatedCount
  })).setMimeType(ContentService.MimeType.JSON);
  break;