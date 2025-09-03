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
// 포커 핸드 로거 스프레드시트 ID
// CSV URL에서 추출한 공개 ID는 Apps Script에서 직접 사용할 수 없습니다
// 실제 Google Sheets 스프레드시트 ID를 입력해야 합니다
const SPREADSHEET_ID = '1vSDY_i4330JANAjIz4sMncdJdRHsOkfUCjQusHTGQk2tykrhA4d09LeIp3XRbLd8hkN6SgSB47k_nux';
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
    
    // 각 업데이트 항목 처리
    updates.forEach(function(update) {
      try {
        var rowIndex = update.rowIndex;
        
        // 유효성 검사
        if (rowIndex < 2) {
          errors.push('행 ' + rowIndex + ': 헤더 행은 수정할 수 없습니다');
          return;
        }
        
        // J열부터 N열까지 한 번에 업데이트 (열 인덱스: J=10, K=11, L=12, M=13, N=14)
        indexSheet.getRange(rowIndex, 10, 1, 5).setValues([[
          update.cam,              // J열
          update.camFile01name,    // K열
          update.camFile01number,  // L열
          update.camFile02name,    // M열
          update.camFile02number   // N열
        ]]);
        
        updatedCount++;
      } catch(err) {
        errors.push('행 ' + update.rowIndex + ': ' + err.toString());
      }
    });
    
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

// ============ 스프레드시트 ID 찾기 함수 ============
function findSpreadsheetId() {
  Logger.log('=== 스프레드시트 ID 찾기 시작 ===');
  
  // 방법 1: 현재 사용자의 모든 스프레드시트 검색
  try {
    Logger.log('DriveApp으로 스프레드시트 검색 중...');
    var files = DriveApp.getFilesByType(MimeType.GOOGLE_SHEETS);
    var count = 0;
    
    while (files.hasNext() && count < 20) { // 최대 20개만 확인
      var file = files.next();
      var fileName = file.getName();
      var fileId = file.getId();
      
      Logger.log('스프레드시트 발견: "' + fileName + '" - ID: ' + fileId);
      
      // 포커 관련 키워드가 포함된 시트 찾기
      if (fileName.toLowerCase().includes('poker') || 
          fileName.toLowerCase().includes('포커') || 
          fileName.toLowerCase().includes('hand') || 
          fileName.toLowerCase().includes('index')) {
        Logger.log('>>> 포커 관련 시트 가능성: "' + fileName + '" - ID: ' + fileId);
        
        // 시트 내용 확인
        try {
          var spreadsheet = SpreadsheetApp.openById(fileId);
          var sheets = spreadsheet.getSheets();
          var sheetNames = sheets.map(function(sheet) { return sheet.getName(); });
          Logger.log('    시트 목록: ' + sheetNames.join(', '));
          
          // Index와 Type 시트가 모두 있는지 확인
          if (sheetNames.includes('Index') && sheetNames.includes('Type')) {
            Logger.log('🎯 올바른 스프레드시트 발견!');
            Logger.log('    이름: "' + fileName + '"');
            Logger.log('    ID: ' + fileId);
            Logger.log('    URL: https://docs.google.com/spreadsheets/d/' + fileId);
            return fileId;
          }
        } catch(sheetError) {
          Logger.log('    시트 열기 실패: ' + sheetError.toString());
        }
      }
      count++;
    }
    
    Logger.log('포커 핸드 로거 시트를 찾을 수 없습니다.');
    return null;
    
  } catch(error) {
    Logger.log('검색 실패: ' + error.toString());
    return null;
  }
}

// ============ 간단한 테스트 함수 ============
function simpleTest() {
  Logger.log('=== 간단한 테스트 시작 ===');
  try {
    Logger.log('현재 설정된 스프레드시트 ID: ' + SPREADSHEET_ID);
    
    // 먼저 실제 ID 찾기 시도
    Logger.log('실제 스프레드시트 ID 검색 중...');
    var realId = findSpreadsheetId();
    
    if (realId) {
      Logger.log('✅ 실제 스프레드시트 ID 발견: ' + realId);
      var spreadsheet = SpreadsheetApp.openById(realId);
      Logger.log('✅ 스프레드시트 이름: ' + spreadsheet.getName());
      Logger.log('=== 테스트 완료 - 실제 ID 사용 ===');
      return '성공 - 실제 ID: ' + realId;
    } else {
      Logger.log('❌ 실제 스프레드시트를 찾을 수 없습니다');
      return '실패 - 스프레드시트 없음';
    }
    
  } catch(error) {
    Logger.log('오류: ' + error.toString());
    return '실패: ' + error.toString();
  }
}

// ============ 테스트 함수 ============
function testConnection() {
  try {
    Logger.log('🔍 === 연결 테스트 시작 ===');
    console.log('🔍 === 연결 테스트 시작 ===');
    console.log('🆔 스프레드시트 ID: ' + SPREADSHEET_ID);
    
    var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    console.log('✅ 스프레드시트 연결 성공!');
    console.log('📋 스프레드시트 이름: "' + spreadsheet.getName() + '"');
    console.log('🔗 스프레드시트 URL: https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID);
    
    var indexSheet = spreadsheet.getSheetByName('Index');
    var typeSheet = spreadsheet.getSheetByName('Type');
    
    console.log('📄 시트 확인:');
    console.log('  - Index 시트: ' + (indexSheet ? '✅ 찾음' : '❌ 없음'));
    console.log('  - Type 시트: ' + (typeSheet ? '✅ 찾음' : '❌ 없음'));
    
    if (indexSheet) {
      var lastRow = indexSheet.getLastRow();
      var lastCol = indexSheet.getLastColumn();
      console.log('📊 Index 시트 정보:');
      console.log('  - 총 행 수: ' + lastRow);
      console.log('  - 총 열 수: ' + lastCol);
      
      // 헤더 정보 확인
      if (lastRow > 0) {
        var headers = indexSheet.getRange(1, 1, 1, Math.min(15, lastCol)).getValues()[0];
        console.log('📋 헤더 정보 (A~O열):');
        for (var h = 0; h < headers.length; h++) {
          var colLetter = String.fromCharCode(65 + h); // A, B, C...
          console.log('  - ' + colLetter + '열: "' + headers[h] + '"');
        }
      }
      
      // 카메라 정보가 없는 행 찾기
      var indexData = indexSheet.getDataRange().getValues();
      var emptyCount = 0;
      var totalDataRows = indexData.length - 1;
      
      console.log('🔍 카메라 정보 분석 중...');
      console.log('📊 전체 데이터 행 수: ' + totalDataRows);
      
      for (var i = 1; i < indexData.length; i++) {
        var row = indexData[i];
        var handNumber = row[0];   // A열
        var cam1no = row[11];      // L열
        var cam2no = row[13];      // N열
        
        if (handNumber && (!cam1no || !cam2no || cam1no === '' || cam2no === '')) {
          emptyCount++;
          if (emptyCount <= 5) {
            console.log('📝 빈 행 예시 ' + emptyCount + ':');
            console.log('  - 행 번호: ' + (i + 1));
            console.log('  - HandNumber (A열): "' + handNumber + '"');
            console.log('  - Cam1no (L열): "' + cam1no + '"');
            console.log('  - Cam2no (N열): "' + cam2no + '"');
            console.log('  - J열 (cam): "' + row[9] + '"');
            console.log('  - K열 (camFile01name): "' + row[10] + '"');
            console.log('  - M열 (camFile02name): "' + row[12] + '"');
          }
        }
      }
      
      console.log('📈 분석 결과:');
      console.log('  - 전체 데이터 행: ' + totalDataRows + '개');
      console.log('  - 카메라 정보 없는 행: ' + emptyCount + '개');
      console.log('  - 카메라 정보 있는 행: ' + (totalDataRows - emptyCount) + '개');
      console.log('  - 완료 비율: ' + Math.round((totalDataRows - emptyCount) / totalDataRows * 100) + '%');
    }
    
    if (typeSheet) {
      console.log('📷 Type 시트 카메라 이름 확인:');
      var typeData = typeSheet.getRange('A1:A10').getValues(); // A1~A10까지 확인
      
      console.log('📋 Type 시트 A1~A10 전체 내용:');
      for (var t = 0; t < typeData.length; t++) {
        if (typeData[t][0]) {
          console.log('  - A' + (t + 1) + ': "' + typeData[t][0] + '"');
        }
      }
      
      var cam1 = (typeData[1] && typeData[1][0]) ? String(typeData[1][0]).trim() : 'empty';
      var cam2 = (typeData[2] && typeData[2][0]) ? String(typeData[2][0]).trim() : 'empty';
      
      console.log('🎥 추출된 카메라 이름:');
      console.log('  - 카메라1 (A2): "' + cam1 + '"');
      console.log('  - 카메라2 (A3): "' + cam2 + '"');
    }
    
    console.log('✅ === 연결 테스트 완료 ===');
    return '테스트 성공';
    
  } catch(error) {
    console.error('💥 === 연결 테스트 실패 ===');
    console.error('오류 메시지: ' + error.message);
    console.error('오류 전체: ' + error.toString());
    console.error('오류 스택: ' + error.stack);
    return '테스트 실패: ' + error.toString();
  }
}

// ============ 간단한 1행 테스트 함수 ============
function testSingleUpdate() {
  try {
    console.log('단일 행 테스트 시작...');
    
    var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    var indexSheet = spreadsheet.getSheetByName('Index');
    var typeSheet = spreadsheet.getSheetByName('Type');
    
    // 카메라 이름 가져오기
    var typeData = typeSheet.getRange('A2:A3').getValues();
    var cam1Name = (typeData[0] && typeData[0][0]) ? String(typeData[0][0]).trim() : 'Cam1';
    var cam2Name = (typeData[1] && typeData[1][0]) ? String(typeData[1][0]).trim() : 'Cam2';
    
    // 빈 행 찾기
    var indexData = indexSheet.getDataRange().getValues();
    for (var i = 1; i < indexData.length; i++) {
      var row = indexData[i];
      if (row[0] && (!row[11] || !row[13])) { // 첫 번째 빈 행 찾기
        console.log('테스트 대상 행: ' + (i + 1) + ', HandNumber: ' + row[0]);
        
        // 테스트 업데이트
        indexSheet.getRange(i + 1, 10, 1, 5).setValues([[
          cam1Name + '+' + cam2Name,  // J열
          cam1Name,                    // K열
          '9999',                      // L열 (테스트용)
          cam2Name,                    // M열
          '9998'                       // N열 (테스트용)
        ]]);
        
        console.log('테스트 업데이트 완료! 행 ' + (i + 1) + '에 9999/9998 입력');
        return '테스트 성공: 행 ' + (i + 1);
      }
    }
    
    return '업데이트할 빈 행이 없습니다';
    
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
    console.log('🚀 === 카메라 정보 일괄 업데이트 시작 ===');
    console.log('📊 설정값 - 시작번호: ' + startNumber + ', 증가간격: ' + increment);
    
    // 1. 스프레드시트 연결
    console.log('📋 1단계: 스프레드시트 연결 중...');
    var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    console.log('✅ 스프레드시트 연결 성공: "' + spreadsheet.getName() + '"');
    
    // 2. 시트 찾기
    console.log('📄 2단계: 시트 확인 중...');
    var indexSheet = spreadsheet.getSheetByName('Index');
    var typeSheet = spreadsheet.getSheetByName('Type');
    
    if (!indexSheet) {
      throw new Error('❌ Index 시트를 찾을 수 없습니다');
    }
    if (!typeSheet) {
      throw new Error('❌ Type 시트를 찾을 수 없습니다');
    }
    
    var indexLastRow = indexSheet.getLastRow();
    console.log('✅ Index 시트 찾음 - 총 행 수: ' + indexLastRow);
    console.log('✅ Type 시트 찾음');
    
    // 3. 카메라 이름 가져오기
    console.log('📷 3단계: 카메라 이름 가져오기...');
    var typeData = typeSheet.getRange('A2:A3').getValues();
    console.log('📖 Type 시트 A2:A3 원본 데이터:', JSON.stringify(typeData));
    
    var cam1Name = (typeData[0] && typeData[0][0]) ? String(typeData[0][0]).trim() : 'Cam1';
    var cam2Name = (typeData[1] && typeData[1][0]) ? String(typeData[1][0]).trim() : 'Cam2';
    
    console.log('🎥 카메라1 이름: "' + cam1Name + '"');
    console.log('🎥 카메라2 이름: "' + cam2Name + '"');
    
    // 4. Index 데이터 분석
    console.log('🔍 4단계: Index 시트 데이터 분석 중...');
    var indexData = indexSheet.getDataRange().getValues();
    var totalRows = indexData.length;
    var currentNum = startNumber;
    var updateCount = 0;
    var emptyRowCount = 0;
    var skippedCount = 0;
    
    console.log('📊 Index 시트 전체 데이터 행 수: ' + totalRows);
    
    // 먼저 빈 행 개수 파악
    for (var i = 1; i < totalRows; i++) {
      var row = indexData[i];
      var handNumber = row[0]; // A열
      var cam1no = row[11];    // L열 (cam1no)
      var cam2no = row[13];    // N열 (cam2no)
      
      if (handNumber && (!cam1no || !cam2no || cam1no === '' || cam2no === '')) {
        emptyRowCount++;
      }
    }
    
    console.log('📈 분석 결과:');
    console.log('  - 전체 데이터 행: ' + (totalRows - 1) + '개');
    console.log('  - 카메라 정보 없는 행: ' + emptyRowCount + '개');
    
    if (emptyRowCount === 0) {
      console.log('⚠️ 업데이트할 행이 없습니다. 모든 행에 이미 카메라 정보가 있습니다.');
      return 0;
    }
    
    // 5. 실제 업데이트 실행
    console.log('💾 5단계: 카메라 정보 업데이트 시작...');
    console.log('🔄 예상 업데이트 행 수: ' + emptyRowCount + '개');
    
    for (var i = 1; i < totalRows; i++) {
      var row = indexData[i];
      var handNumber = row[0]; // A열
      var cam1no = row[11];    // L열 (cam1no)
      var cam2no = row[13];    // N열 (cam2no)
      
      console.log('🔍 행 ' + (i + 1) + ' 검사 중...');
      console.log('  - HandNumber: "' + handNumber + '"');
      console.log('  - 기존 Cam1no: "' + cam1no + '"');
      console.log('  - 기존 Cam2no: "' + cam2no + '"');
      
      // handNumber는 있지만 cam1no 또는 cam2no가 비어있는 경우
      if (handNumber && (!cam1no || !cam2no || cam1no === '' || cam2no === '')) {
        var newCam1no = String(currentNum).padStart(4, '0');
        var newCam2no = String(currentNum + increment).padStart(4, '0');
        
        console.log('✏️ 행 ' + (i + 1) + ' 업데이트 준비:');
        console.log('  - 새 Cam1no: "' + newCam1no + '"');
        console.log('  - 새 Cam2no: "' + newCam2no + '"');
        
        try {
          // 업데이트 전 현재 상태 확인
          var beforeUpdate = indexSheet.getRange(i + 1, 10, 1, 5).getValues()[0];
          console.log('📋 업데이트 전 J~N열 값:', JSON.stringify(beforeUpdate));
          
          // J부터 N열까지 업데이트 (열 인덱스: J=10, K=11, L=12, M=13, N=14)
          var updateData = [
            cam1Name + '+' + cam2Name,  // J열
            cam1Name,                    // K열
            newCam1no,                   // L열
            cam2Name,                    // M열
            newCam2no                    // N열
          ];
          
          console.log('📝 업데이트할 데이터:', JSON.stringify(updateData));
          
          indexSheet.getRange(i + 1, 10, 1, 5).setValues([updateData]);
          
          // 업데이트 후 확인
          var afterUpdate = indexSheet.getRange(i + 1, 10, 1, 5).getValues()[0];
          console.log('📋 업데이트 후 J~N열 값:', JSON.stringify(afterUpdate));
          
          updateCount++;
          currentNum += increment * 2;
          
          console.log('✅ 행 ' + (i + 1) + ' 업데이트 성공!');
          console.log('  - HandNumber: "' + handNumber + '"');
          console.log('  - 할당된 번호: ' + newCam1no + '/' + newCam2no);
          console.log('  - 진행률: ' + updateCount + '/' + emptyRowCount);
          
          // 진행상황 로그 (5개마다)
          if (updateCount % 5 === 0) {
            console.log('📊 중간 진행상황: ' + updateCount + '/' + emptyRowCount + ' 완료 (' + Math.round(updateCount/emptyRowCount*100) + '%)');
          }
          
        } catch(rowError) {
          console.error('❌ 행 ' + (i + 1) + ' 업데이트 실패:');
          console.error('   오류 내용: ' + rowError.toString());
          console.error('   오류 스택: ' + rowError.stack);
          skippedCount++;
        }
      } else {
        console.log('⏭️ 행 ' + (i + 1) + ' 건너뛰기 (이미 카메라 정보 있음 또는 HandNumber 없음)');
      }
    }
    
    console.log('🎉 === 업데이트 완료 ===');
    console.log('📊 최종 결과:');
    console.log('  - 성공: ' + updateCount + '개');
    console.log('  - 실패: ' + skippedCount + '개');
    console.log('  - 전체: ' + emptyRowCount + '개 중 ' + updateCount + '개 처리');
    console.log('  - 성공률: ' + Math.round(updateCount/(updateCount+skippedCount)*100) + '%');
    
    return updateCount;
    
  } catch(error) {
    console.error('💥 === 치명적 오류 발생 ===');
    console.error('오류 메시지: ' + error.message);
    console.error('오류 전체: ' + error.toString());
    console.error('오류 스택: ' + error.stack);
    throw error;
  }
}