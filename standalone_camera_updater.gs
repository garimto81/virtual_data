/**
 * 독립 실행형 Google Apps Script
 * 카메라 정보 일괄 업데이트용 1회성 스크립트
 * 
 * 설정 방법:
 * 1. https://script.google.com 에서 새 프로젝트 생성
 * 2. 이 코드 전체를 복사하여 붙여넣기
 * 3. SPREADSHEET_ID를 실제 스프레드시트 ID로 변경
 * 4. 배포 > 새 배포 > 웹 앱으로 배포
 * 5. 액세스 권한: "모든 사용자" 선택
 * 6. 배포 후 받은 URL을 update_camera_info.html에 입력
 */

// ============ 설정 영역 시작 ============
// 여기에 실제 스프레드시트 ID를 입력하세요
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
// ============ 설정 영역 끝 ============

function doGet() {
  return HtmlService.createHtmlOutput(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>카메라 정보 업데이트 API</title>
      </head>
      <body>
        <h1>카메라 정보 일괄 업데이트 API</h1>
        <p>이 API는 POST 요청만 처리합니다.</p>
        <p>update_camera_info.html 파일을 사용하여 업데이트를 실행하세요.</p>
      </body>
    </html>
  `);
}

function doPost(e) {
  try {
    // 요청 데이터 파싱
    var requestData = JSON.parse(e.parameter.data);
    var action = requestData.action;
    
    switch(action) {
      case 'updateCameraInfo':
        return handleCameraUpdate(requestData);
      
      case 'checkStatus':
        return checkSheetStatus();
        
      default:
        return createErrorResponse('알 수 없는 액션: ' + action);
    }
  } catch(error) {
    return createErrorResponse('요청 처리 중 오류 발생: ' + error.toString());
  }
}

function handleCameraUpdate(requestData) {
  try {
    var updates = requestData.updates;
    var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    var indexSheet = spreadsheet.getSheetByName('Index');
    
    if (!indexSheet) {
      return createErrorResponse('Index 시트를 찾을 수 없습니다');
    }
    
    var updatedCount = 0;
    var errors = [];
    
    // 배치 업데이트를 위한 준비
    var batchUpdates = [];
    
    updates.forEach(function(update) {
      try {
        var rowIndex = update.rowIndex;
        
        // 유효성 검사
        if (rowIndex < 2) {
          errors.push('행 ' + rowIndex + ': 헤더 행은 수정할 수 없습니다');
          return;
        }
        
        // 배치 업데이트 데이터 준비
        batchUpdates.push({
          range: 'Index!J' + rowIndex + ':N' + rowIndex,
          values: [[
            update.cam,              // J열
            update.camFile01name,    // K열
            update.camFile01number,  // L열
            update.camFile02name,    // M열
            update.camFile02number   // N열
          ]]
        });
        
        updatedCount++;
      } catch(err) {
        errors.push('행 ' + update.rowIndex + ': ' + err.toString());
      }
    });
    
    // 배치 업데이트 실행
    if (batchUpdates.length > 0) {
      var batchUpdateRequest = {
        valueInputOption: 'USER_ENTERED',
        data: batchUpdates
      };
      
      Sheets.Spreadsheets.Values.batchUpdate(batchUpdateRequest, SPREADSHEET_ID);
    }
    
    // 업데이트 기록 남기기
    logUpdate(updatedCount, errors);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: '카메라 정보 업데이트 완료',
      updated: updatedCount,
      errors: errors,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch(error) {
    return createErrorResponse('업데이트 실행 중 오류: ' + error.toString());
  }
}

function checkSheetStatus() {
  try {
    var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    var indexSheet = spreadsheet.getSheetByName('Index');
    var typeSheet = spreadsheet.getSheetByName('Type');
    
    if (!indexSheet || !typeSheet) {
      return createErrorResponse('필수 시트를 찾을 수 없습니다');
    }
    
    // Index 시트에서 카메라 정보가 비어있는 행 수 확인
    var indexData = indexSheet.getDataRange().getValues();
    var emptyCount = 0;
    
    for (var i = 1; i < indexData.length; i++) {
      var row = indexData[i];
      // A열(handNumber)은 있지만 L열(cam1no) 또는 N열(cam2no)이 비어있는 경우
      if (row[0] && (!row[11] || !row[13])) {
        emptyCount++;
      }
    }
    
    // Type 시트에서 카메라 이름 가져오기
    var typeData = typeSheet.getRange('A2:A3').getValues();
    var cam1Name = typeData[0][0] || 'Cam1';
    var cam2Name = typeData[1][0] || 'Cam2';
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      totalRows: indexData.length - 1,
      emptyRows: emptyCount,
      cam1Name: cam1Name,
      cam2Name: cam2Name,
      spreadsheetName: spreadsheet.getName()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch(error) {
    return createErrorResponse('상태 확인 중 오류: ' + error.toString());
  }
}

function logUpdate(updatedCount, errors) {
  try {
    var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    var logSheet = spreadsheet.getSheetByName('UpdateLog');
    
    // 로그 시트가 없으면 생성
    if (!logSheet) {
      logSheet = spreadsheet.insertSheet('UpdateLog');
      logSheet.getRange(1, 1, 1, 4).setValues([['Timestamp', 'Updated Count', 'Errors', 'User']]);
    }
    
    // 로그 추가
    var lastRow = logSheet.getLastRow();
    logSheet.getRange(lastRow + 1, 1, 1, 4).setValues([[
      new Date(),
      updatedCount,
      errors.length > 0 ? errors.join('; ') : 'No errors',
      Session.getActiveUser().getEmail()
    ]]);
    
  } catch(err) {
    // 로그 실패는 무시 (메인 작업에 영향을 주지 않도록)
    console.error('로그 기록 실패:', err);
  }
}

function createErrorResponse(message) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'error',
    message: message,
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

// ============ 테스트 함수 ============
function testConnection() {
  try {
    var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    console.log('연결 성공! 스프레드시트 이름:', spreadsheet.getName());
    
    var indexSheet = spreadsheet.getSheetByName('Index');
    var typeSheet = spreadsheet.getSheetByName('Type');
    
    console.log('Index 시트:', indexSheet ? '찾음' : '없음');
    console.log('Type 시트:', typeSheet ? '찾음' : '없음');
    
    if (indexSheet) {
      var lastRow = indexSheet.getLastRow();
      console.log('Index 시트 총 행 수:', lastRow);
    }
    
    return '테스트 성공';
  } catch(error) {
    console.error('테스트 실패:', error);
    return '테스트 실패: ' + error.toString();
  }
}

// ============ 수동 실행 함수 (선택사항) ============
function manualUpdate() {
  // 이 함수를 Apps Script 에디터에서 직접 실행할 수 있습니다
  var startNumber = 1;
  var increment = 1;
  
  try {
    var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    var indexSheet = spreadsheet.getSheetByName('Index');
    var typeSheet = spreadsheet.getSheetByName('Type');
    
    // 카메라 이름 가져오기
    var typeData = typeSheet.getRange('A2:A3').getValues();
    var cam1Name = typeData[0][0] || 'Cam1';
    var cam2Name = typeData[1][0] || 'Cam2';
    
    // Index 데이터 가져오기
    var indexData = indexSheet.getDataRange().getValues();
    var currentNum = startNumber;
    var updateCount = 0;
    
    for (var i = 1; i < indexData.length; i++) {
      var row = indexData[i];
      
      // handNumber는 있지만 cam1no가 없는 경우
      if (row[0] && !row[11]) {
        var cam1no = String(currentNum).padStart(4, '0');
        var cam2no = String(currentNum + increment).padStart(4, '0');
        
        // J부터 N열까지 업데이트
        indexSheet.getRange(i + 1, 10, 1, 5).setValues([[
          cam1Name + '+' + cam2Name,  // J열
          cam1Name,                    // K열
          cam1no,                      // L열
          cam2Name,                    // M열
          cam2no                       // N열
        ]]);
        
        updateCount++;
        currentNum += increment * 2;
        
        // 10개마다 진행상황 로그
        if (updateCount % 10 === 0) {
          console.log(updateCount + '개 행 업데이트 완료...');
        }
      }
    }
    
    console.log('총 ' + updateCount + '개 행 업데이트 완료!');
    return updateCount;
    
  } catch(error) {
    console.error('수동 업데이트 실패:', error);
    throw error;
  }
}