/****************************************************
 * Poker Hand Logger - Apps Script Backend v65
 * Type 시트 기반 - IN/OUT 두 가지 상태만 사용
 *
 * v65 변경사항 (2025-09-17):
 * - updatePlayerChips 함수 개선: 기존 플레이어 없으면 새로 추가
 * - 칩 수정 시 중복 제거 로직 자동 실행 추가
 * - 칩 수정으로 인한 중복 플레이어 생성 문제 해결
 *
 * v64 변경사항:
 * - 중복 제거를 일괄 등록 시 자동 처리하도록 아키텍처 변경
 * - batchUpdatePlayers()에서 중복 제거를 마지막에 실행
 * - 별도 중복 제거 버튼 제거 (프론트엔드에서 처리)
 *
 * v63 변경사항:
 * - 중복 플레이어 감지 및 제거 시스템 구현
 * - removeDuplicatePlayers() 함수 추가
 * - addPlayer() 및 batchUpdatePlayers()에 자동 중복 제거 로직 추가
 * - 'removeDuplicates' API 액션 추가
 * - 테이블_플레이어 조합으로 강화된 중복 감지
 *
 * v62 변경사항:
 * - 삭제 로직 디버깅 강화 (상세 로그 추가)
 * - 삭제 조건 완화 (STATUS 조건 제거)
 * - 에러 처리 개선 (상세 오류 정보 제공)
 * - 삭제 로직 변경: OUT 처리 → 실제 행 삭제
 * - 삭제 후 자동 시트 재정렬
 * - 중복 플레이어 처리 로직 개선
 * - sortSheet 이중 호출 버그 수정
 * - 일괄 업데이트 시 자동 정렬
 *
 * Type 시트 구조 (v66 - 새 구조):
 * A: Player
 * B: Table
 * C: Notable
 * D: Chips
 * E: UpdatedAt
 * F: Seat
 * G: Status (IN/OUT만 사용)
 ****************************************************/

const SHEET_ID = '1J-lf8bYTLPbpdhieUNdb8ckW_uwdQ3MtSBLmyRIwH7U';

// Type 시트 열 인덱스 (0-based for array)
const TYPE_COLUMNS = {
  PLAYER: 0,      // A열 - Player
  TABLE: 1,       // B열 - Table
  NOTABLE: 2,     // C열 - Notable
  CHIPS: 3,       // D열 - Chips
  UPDATED_AT: 4,  // E열 - UpdatedAt
  SEAT: 5,        // F열 - Seat
  STATUS: 6       // G열 - Status (IN/OUT만 사용)
};

// Range용 (1-based)
const RANGE_COLUMNS = {
  PLAYER: 1,      // A열
  TABLE: 2,       // B열
  NOTABLE: 3,     // C열
  CHIPS: 4,       // D열
  UPDATED_AT: 5,  // E열
  SEAT: 6,        // F열
  STATUS: 7       // G열
};

// ===== 유틸리티 함수 =====

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function _open() {
  return SpreadsheetApp.openById(SHEET_ID);
}

function _parseRequestBody(e) {
  // FormData 방식 - e.parameter에 직접 접근
  if (e && e.parameter) {
    // payload가 있으면 payload 파싱 시도 (구버전 호환)
    if (e.parameter.payload) {
      try {
        return JSON.parse(e.parameter.payload);
      } catch (err) {
        console.error('Payload 파싱 실패:', err);
      }
    }
    // FormData로 전송된 경우 parameter 직접 반환
    return e.parameter;
  }

  // JSON Body 방식
  if (e && e.postData && e.postData.type === 'application/json') {
    try {
      return JSON.parse(e.postData.contents);
    } catch (err) {
      console.error('JSON 파싱 실패:', err);
    }
  }

  return {};
}

// ===== 테이블 관리 API =====

// 테이블 목록 조회
function getTableList() {
  try {
    const sheet = _open().getSheetByName('Type');
    if (!sheet) return {success: false, tables: []};
    
    const data = sheet.getDataRange().getValues();
    const tables = new Map();
    
    for (let i = 1; i < data.length; i++) {
      const tableName = data[i][TYPE_COLUMNS.TABLE];
      const status = data[i][TYPE_COLUMNS.STATUS] || 'IN';
      
      // IN 상태인 플레이어만 카운트
      if (tableName && status === 'IN') {
        const count = tables.get(tableName) || 0;
        tables.set(tableName, count + 1);
      }
    }
    
    return {
      success: true,
      tables: Array.from(tables.entries()).map(([name, count]) => ({
        name: name,
        playerCount: count
      }))
    };
  } catch (error) {
    console.error('getTableList error:', error);
    return {success: false, message: error.toString(), tables: []};
  }
}

// 테이블별 플레이어 조회 (IN 상태만)
function getPlayersByTable(tableName) {
  try {
    const sheet = _open().getSheetByName('Type');
    if (!sheet) return {success: false, players: []};
    
    const data = sheet.getDataRange().getValues();
    const players = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const table = row[TYPE_COLUMNS.TABLE];
      const status = row[TYPE_COLUMNS.STATUS] || 'IN';
      
      // 해당 테이블의 IN 상태 플레이어만
      if (table === tableName && status === 'IN') {
        players.push({
          rowNumber: i + 1,
          name: row[TYPE_COLUMNS.PLAYER],
          table: table,
          notable: row[TYPE_COLUMNS.NOTABLE] === true || row[TYPE_COLUMNS.NOTABLE] === 'TRUE',
          chips: row[TYPE_COLUMNS.CHIPS] || 0,
          seat: row[TYPE_COLUMNS.SEAT] || null,
          status: status,
          updatedAt: row[TYPE_COLUMNS.UPDATED_AT]
        });
      }
    }
    
    // 좌석 번호순 정렬
    players.sort((a, b) => (a.seat || 99) - (b.seat || 99));
    
    return {success: true, players};
  } catch (error) {
    console.error('getPlayersByTable error:', error);
    return {success: false, message: error.toString(), players: []};
  }
}

// 플레이어 추가/수정
function upsertPlayer(playerData) {
  try {
    const sheet = _open().getSheetByName('Type');
    if (!sheet) return {success: false, message: 'Type 시트를 찾을 수 없습니다'};
    
    const data = sheet.getDataRange().getValues();
    
    // 좌석 중복 체크 (같은 테이블, 같은 좌석, IN 상태)
    if (playerData.seat) {
      for (let i = 1; i < data.length; i++) {
        if (data[i][TYPE_COLUMNS.TABLE] === playerData.table &&
            data[i][TYPE_COLUMNS.SEAT] === playerData.seat &&
            data[i][TYPE_COLUMNS.STATUS] === 'IN' &&
            data[i][TYPE_COLUMNS.PLAYER] !== playerData.name) {
          return {success: false, message: `좌석 ${playerData.seat}번은 이미 사용 중입니다`};
        }
      }
    }
    
    // 기존 플레이어 찾기 (같은 이름, 같은 테이블, IN 상태)
    let targetRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][TYPE_COLUMNS.PLAYER] === playerData.name && 
          data[i][TYPE_COLUMNS.TABLE] === playerData.table &&
          data[i][TYPE_COLUMNS.STATUS] === 'IN') {
        targetRow = i + 1;
        break;
      }
    }
    
    const now = new Date();
    
    if (targetRow === -1) {
      // OUT 상태의 기존 데이터가 있는지 확인
      let outRow = -1;
      for (let i = 1; i < data.length; i++) {
        if (data[i][TYPE_COLUMNS.TABLE] === playerData.table &&
            data[i][TYPE_COLUMNS.STATUS] === 'OUT') {
          outRow = i + 1;
          break;
        }
      }
      
      if (outRow !== -1) {
        // OUT 상태 행을 재사용
        sheet.getRange(outRow, RANGE_COLUMNS.PLAYER).setValue(playerData.name);
        sheet.getRange(outRow, RANGE_COLUMNS.NOTABLE).setValue(playerData.notable ? 'TRUE' : 'FALSE');
        sheet.getRange(outRow, RANGE_COLUMNS.CHIPS).setValue(playerData.chips || 0);
        sheet.getRange(outRow, RANGE_COLUMNS.SEAT).setValue(playerData.seat || '');
        sheet.getRange(outRow, RANGE_COLUMNS.STATUS).setValue('IN');
        sheet.getRange(outRow, RANGE_COLUMNS.UPDATED_AT).setValue(now);
        
        return {success: true, action: 'reused', row: outRow};
      } else {
        // 새 행 추가
        const newRow = new Array(8);
        newRow[TYPE_COLUMNS.CAMERA] = '';
        newRow[TYPE_COLUMNS.PLAYER] = playerData.name;
        newRow[TYPE_COLUMNS.TABLE] = playerData.table;
        newRow[TYPE_COLUMNS.NOTABLE] = playerData.notable ? 'TRUE' : 'FALSE';
        newRow[TYPE_COLUMNS.CHIPS] = playerData.chips || 0;
        newRow[TYPE_COLUMNS.UPDATED_AT] = now;
        newRow[TYPE_COLUMNS.SEAT] = playerData.seat || '';
        newRow[TYPE_COLUMNS.STATUS] = 'IN';
        
        sheet.appendRow(newRow);
        return {success: true, action: 'created', row: sheet.getLastRow()};
      }
      
    } else {
      // 기존 플레이어 수정
      if (playerData.chips !== undefined) {
        sheet.getRange(targetRow, RANGE_COLUMNS.CHIPS).setValue(playerData.chips);
      }
      if (playerData.seat !== undefined) {
        sheet.getRange(targetRow, RANGE_COLUMNS.SEAT).setValue(playerData.seat);
      }
      if (playerData.notable !== undefined) {
        sheet.getRange(targetRow, RANGE_COLUMNS.NOTABLE)
          .setValue(playerData.notable ? 'TRUE' : 'FALSE');
      }
      
      // UpdatedAt 갱신
      sheet.getRange(targetRow, RANGE_COLUMNS.UPDATED_AT).setValue(now);
      
      return {success: true, action: 'updated', row: targetRow};
    }
  } catch (error) {
    console.error('upsertPlayer error:', error);
    return {success: false, message: error.toString()};
  }
}

// 플레이어 OUT 처리 (캐시아웃)
function cashOutPlayer(playerName, tableName, finalChips) {
  try {
    const sheet = _open().getSheetByName('Type');
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][TYPE_COLUMNS.PLAYER] === playerName && 
          data[i][TYPE_COLUMNS.TABLE] === tableName &&
          data[i][TYPE_COLUMNS.STATUS] === 'IN') {
        const row = i + 1;
        
        // 최종 칩 업데이트
        if (finalChips !== undefined) {
          sheet.getRange(row, RANGE_COLUMNS.CHIPS).setValue(finalChips);
        }
        
        // Status를 OUT으로 변경
        sheet.getRange(row, RANGE_COLUMNS.STATUS).setValue('OUT');
        sheet.getRange(row, RANGE_COLUMNS.UPDATED_AT).setValue(new Date());
        
        // 좌석 비우기 (선택사항)
        // sheet.getRange(row, RANGE_COLUMNS.SEAT).setValue('');
        
        return {success: true, message: `${playerName} 캐시아웃 완료`};
      }
    }
    
    return {success: false, message: '플레이어를 찾을 수 없습니다'};
  } catch (error) {
    console.error('cashOutPlayer error:', error);
    return {success: false, message: error.toString()};
  }
}

// 중복 플레이어 감지 및 제거 함수
function removeDuplicatePlayers() {
  try {
    const sheet = _open().getSheetByName('Type');
    if (!sheet) return {success: false, message: 'Type 시트를 찾을 수 없습니다'};

    const data = sheet.getDataRange().getValues();
    const seenPlayers = new Map(); // table_player 조합으로 중복 체크
    const duplicateRows = [];

    console.log('[v3.2.9] 중복 플레이어 감지 시작...');

    // 중복 플레이어 찾기 (헤더 제외하고 시작)
    for (let i = 1; i < data.length; i++) {
      const playerName = data[i][TYPE_COLUMNS.PLAYER];
      const tableName = data[i][TYPE_COLUMNS.TABLE];
      const status = data[i][TYPE_COLUMNS.STATUS];

      // IN 상태 플레이어만 체크
      if (status === 'IN' && playerName && tableName) {
        const key = `${tableName}_${playerName}`;

        if (seenPlayers.has(key)) {
          // 중복 발견 - 나중 행을 삭제 대상으로 표시
          duplicateRows.push(i + 1); // 1-based row number
          console.log(`[v3.2.9] 중복 플레이어 발견: ${playerName} (테이블: ${tableName}) - 행 ${i + 1} 삭제 예정`);
        } else {
          seenPlayers.set(key, i + 1); // 첫 번째 발견된 행 저장
        }
      }
    }

    // 중복 행 삭제 (역순으로 삭제해야 행 번호가 안 꼬임)
    if (duplicateRows.length > 0) {
      duplicateRows.sort((a, b) => b - a); // 내림차순 정렬

      for (const rowNum of duplicateRows) {
        console.log(`[v3.2.9] 중복 행 삭제: ${rowNum}`);
        sheet.deleteRow(rowNum);
      }

      console.log(`[v3.2.9] 중복 플레이어 ${duplicateRows.length}개 삭제 완료`);
      return {success: true, message: `중복 플레이어 ${duplicateRows.length}개 제거됨`};
    } else {
      console.log('[v3.2.9] 중복 플레이어 없음');
      return {success: true, message: '중복 플레이어 없음'};
    }

  } catch (error) {
    console.error('[v3.2.9] removeDuplicatePlayers error:', error);
    return {success: false, message: error.toString()};
  }
}

// 플레이어 추가 (새로운 함수) - 중복 체크 강화
function addPlayer(playerData) {
  try {
    const sheet = _open().getSheetByName('Type');
    if (!sheet) return {success: false, message: 'Type 시트를 찾을 수 없습니다'};

    const data = sheet.getDataRange().getValues();

    // 좌석 중복 체크
    if (playerData.seat) {
      for (let i = 1; i < data.length; i++) {
        if (data[i][TYPE_COLUMNS.TABLE] === playerData.table &&
            data[i][TYPE_COLUMNS.SEAT] === playerData.seat &&
            data[i][TYPE_COLUMNS.STATUS] === 'IN') {
          return {success: false, message: `좌석 ${playerData.seat}번은 이미 사용 중입니다`};
        }
      }
    }

    // 같은 이름의 플레이어가 이미 있는지 체크 (강화된 검사)
    for (let i = 1; i < data.length; i++) {
      if (data[i][TYPE_COLUMNS.PLAYER] === playerData.name &&
          data[i][TYPE_COLUMNS.TABLE] === playerData.table &&
          data[i][TYPE_COLUMNS.STATUS] === 'IN') {
        console.log(`[v3.2.9] 중복 플레이어 추가 시도 차단: ${playerData.name} (테이블: ${playerData.table})`);
        return {success: false, message: '이미 존재하는 플레이어입니다'};
      }
    }

    // 새 행 추가 (새 구조: A:Player, B:Table, C:Notable, D:Chips, E:UpdatedAt, F:Seat, G:Status)
    const newRow = sheet.getLastRow() + 1;
    sheet.getRange(newRow, RANGE_COLUMNS.PLAYER).setValue(playerData.name);
    sheet.getRange(newRow, RANGE_COLUMNS.TABLE).setValue(playerData.table);
    sheet.getRange(newRow, RANGE_COLUMNS.NOTABLE).setValue('FALSE');
    sheet.getRange(newRow, RANGE_COLUMNS.CHIPS).setValue(playerData.chips || 0);
    sheet.getRange(newRow, RANGE_COLUMNS.UPDATED_AT).setValue(new Date());
    sheet.getRange(newRow, RANGE_COLUMNS.SEAT).setValue(playerData.seat || '');
    sheet.getRange(newRow, RANGE_COLUMNS.STATUS).setValue(playerData.status || 'IN');

    // 추가 완료 후 중복 제거
    const cleanupResult = removeDuplicatePlayers();
    console.log('[v3.2.9] 플레이어 추가 후 중복 정리:', cleanupResult);

    return {
      success: true,
      message: `플레이어가 추가되었습니다${cleanupResult.success && cleanupResult.message.includes('개') ? ' (중복 ' + cleanupResult.message + ' 제거됨)' : ''}`
    };
  } catch (error) {
    console.error('addPlayer error:', error);
    return {success: false, message: error.toString()};
  }
}

// 플레이어 좌석 업데이트
function updatePlayerSeat(playerName, tableName, newSeat) {
  try {
    const sheet = _open().getSheetByName('Type');
    const data = sheet.getDataRange().getValues();

    // 좌석 중복 체크 (새 좌석이 있을 경우)
    if (newSeat) {
      for (let i = 1; i < data.length; i++) {
        if (data[i][TYPE_COLUMNS.TABLE] === tableName &&
            data[i][TYPE_COLUMNS.SEAT] === newSeat &&
            data[i][TYPE_COLUMNS.STATUS] === 'IN' &&
            data[i][TYPE_COLUMNS.PLAYER] !== playerName) {
          return {success: false, message: `좌석 ${newSeat}번은 이미 사용 중입니다`};
        }
      }
    }

    // 플레이어 찾기
    for (let i = 1; i < data.length; i++) {
      if (data[i][TYPE_COLUMNS.PLAYER] === playerName &&
          data[i][TYPE_COLUMNS.TABLE] === tableName &&
          data[i][TYPE_COLUMNS.STATUS] === 'IN') {
        const row = i + 1;
        sheet.getRange(row, RANGE_COLUMNS.SEAT).setValue(newSeat || '');
        sheet.getRange(row, RANGE_COLUMNS.UPDATED_AT).setValue(new Date());
        return {success: true, message: '좌석이 업데이트되었습니다'};
      }
    }

    return {success: false, message: '플레이어를 찾을 수 없습니다'};
  } catch (error) {
    console.error('updatePlayerSeat error:', error);
    return {success: false, message: error.toString()};
  }
}

// 플레이어 칩 업데이트
function updatePlayerChips(playerName, tableName, newChips) {
  try {
    const sheet = _open().getSheetByName('Type');
    const data = sheet.getDataRange().getValues();

    console.log(`[v3.2.9] updatePlayerChips 시작: ${playerName}, ${tableName}, ${newChips}`);

    // 기존 플레이어 찾기 (IN 상태)
    for (let i = 1; i < data.length; i++) {
      if (data[i][TYPE_COLUMNS.PLAYER] === playerName &&
          data[i][TYPE_COLUMNS.TABLE] === tableName &&
          data[i][TYPE_COLUMNS.STATUS] === 'IN') {
        const row = i + 1;
        sheet.getRange(row, RANGE_COLUMNS.CHIPS).setValue(newChips || 0);
        sheet.getRange(row, RANGE_COLUMNS.UPDATED_AT).setValue(new Date());

        console.log(`[v3.2.9] 기존 플레이어 칩 업데이트 완료: 행 ${row}`);

        // 칩 업데이트 후 중복 제거 실행
        const cleanupResult = removeDuplicatePlayers();
        console.log('[v3.2.9] 칩 업데이트 후 중복 정리:', cleanupResult);

        return {
          success: true,
          message: `칩이 업데이트되었습니다${cleanupResult.success && cleanupResult.message.includes('개') ? ' (' + cleanupResult.message + ')' : ''}`
        };
      }
    }

    console.log(`[v3.2.9] 기존 플레이어 없음 - 새로 추가: ${playerName} (${tableName})`);

    // 기존 플레이어가 없으면 새로 추가
    const newRow = sheet.getLastRow() + 1;
    const timestamp = new Date();

    // 새 구조: A:Player, B:Table, C:Notable, D:Chips, E:UpdatedAt, F:Seat, G:Status
    sheet.getRange(newRow, RANGE_COLUMNS.PLAYER).setValue(playerName);
    sheet.getRange(newRow, RANGE_COLUMNS.TABLE).setValue(tableName);
    sheet.getRange(newRow, RANGE_COLUMNS.NOTABLE).setValue('');
    sheet.getRange(newRow, RANGE_COLUMNS.CHIPS).setValue(newChips || 0);
    sheet.getRange(newRow, RANGE_COLUMNS.UPDATED_AT).setValue(timestamp);
    sheet.getRange(newRow, RANGE_COLUMNS.SEAT).setValue('');
    sheet.getRange(newRow, RANGE_COLUMNS.STATUS).setValue('IN');

    console.log(`[v3.2.9] 새 플레이어 추가 완료: 행 ${newRow}`);

    // 새 플레이어 추가 후 중복 제거 실행
    const cleanupResult = removeDuplicatePlayers();
    console.log('[v3.2.9] 새 플레이어 추가 후 중복 정리:', cleanupResult);

    return {
      success: true,
      message: `플레이어가 추가되고 칩이 설정되었습니다${cleanupResult.success && cleanupResult.message.includes('개') ? ' (' + cleanupResult.message + ')' : ''}`
    };

  } catch (error) {
    console.error('updatePlayerChips error:', error);
    return {success: false, message: error.toString()};
  }
}

// 일괄 업데이트 함수 - 마지막에 중복 제거
function batchUpdatePlayers(tableName, playersJson, deletedJson) {
  try {
    const sheet = _open().getSheetByName('Type');
    const players = typeof playersJson === 'string' ? JSON.parse(playersJson) : playersJson;
    const deleted = typeof deletedJson === 'string' ? JSON.parse(deletedJson) : deletedJson;

    console.log(`[v3.2.9 batchUpdate 시작] 테이블: ${tableName}`);
    console.log(`[v3.2.9 batchUpdate] 플레이어: ${JSON.stringify(players)}`);
    console.log(`[v3.2.9 batchUpdate] 삭제 대상: ${JSON.stringify(deleted)}`);

    if (!sheet) return {success: false, message: 'Type 시트를 찾을 수 없습니다'};

    const data = sheet.getDataRange().getValues();
    const now = new Date();
    const rowsToDelete = [];

    console.log(`[시트 데이터] 총 ${data.length}개 행`);

    // 1. 삭제 처리 - 실제 행 삭제 (조건 완화)
    for (const playerName of deleted) {
      console.log(`[삭제 검색] ${playerName} in ${tableName}`);

      for (let i = 1; i < data.length; i++) {
        const rowData = data[i];
        const rowPlayer = rowData[TYPE_COLUMNS.PLAYER];
        const rowTable = rowData[TYPE_COLUMNS.TABLE];
        const rowStatus = rowData[TYPE_COLUMNS.STATUS];

        console.log(`[삭제 비교] Row ${i + 1}: ${rowPlayer} | ${rowTable} | ${rowStatus}`);

        // 조건 완화: 이름과 테이블만 매칭 (STATUS 조건 제거)
        if (rowPlayer === playerName && rowTable === tableName) {
          rowsToDelete.push(i + 1); // 1-based row number
          console.log(`[삭제 대상 선정] ${playerName} - Row ${i + 1}`);
          break;
        }
      }
    }

    // 삭제할 행들을 내림차순으로 정렬하여 삭제 (인덱스 변경 방지)
    rowsToDelete.sort((a, b) => b - a);

    for (const rowIndex of rowsToDelete) {
      console.log(`[행 삭제] Row ${rowIndex}`);
      sheet.deleteRow(rowIndex);
    }

    console.log(`[삭제 완료] ${rowsToDelete.length}개 행 삭제됨`);

    // 데이터 재로드 (삭제 후)
    const updatedData = sheet.getDataRange().getValues();

    // 2. 업데이트 및 추가 처리
    for (const player of players) {
      let found = false;

      // 기존 플레이어 찾기 (업데이트된 데이터 사용)
      for (let i = 1; i < updatedData.length; i++) {
        if (updatedData[i][TYPE_COLUMNS.PLAYER] === player.name &&
            updatedData[i][TYPE_COLUMNS.TABLE] === tableName &&
            updatedData[i][TYPE_COLUMNS.STATUS] === 'IN') {
          // 업데이트
          const row = i + 1;
          sheet.getRange(row, RANGE_COLUMNS.SEAT).setValue(player.seat || '');
          sheet.getRange(row, RANGE_COLUMNS.CHIPS).setValue(player.chips || 0);
          sheet.getRange(row, RANGE_COLUMNS.UPDATED_AT).setValue(now);
          console.log(`[업데이트] ${player.name} - Row ${row}`);
          found = true;
          break;
        }
      }

      // 새 플레이어 추가 (새 구조: A:Player, B:Table, C:Notable, D:Chips, E:UpdatedAt, F:Seat, G:Status)
      if (!found) {
        const newRow = sheet.getLastRow() + 1;
        sheet.getRange(newRow, RANGE_COLUMNS.PLAYER).setValue(player.name);
        sheet.getRange(newRow, RANGE_COLUMNS.TABLE).setValue(tableName);
        sheet.getRange(newRow, RANGE_COLUMNS.NOTABLE).setValue(player.notable ? 'TRUE' : 'FALSE');
        sheet.getRange(newRow, RANGE_COLUMNS.CHIPS).setValue(player.chips || 0);
        sheet.getRange(newRow, RANGE_COLUMNS.UPDATED_AT).setValue(now);
        sheet.getRange(newRow, RANGE_COLUMNS.SEAT).setValue(player.seat || '');
        sheet.getRange(newRow, RANGE_COLUMNS.STATUS).setValue('IN');
        console.log(`[추가] ${player.name} - Row ${newRow}`);
      }
    }

    // 3. 시트 정렬 수행
    const sortResult = sortTypeSheet();
    console.log(`[정렬 결과] ${sortResult ? '성공' : '실패'}`);

    // 4. 마지막에 중복 플레이어 제거
    const cleanupResult = removeDuplicatePlayers();
    console.log('[v3.2.9 batchUpdate] 마지막 중복 제거 결과:', cleanupResult);

    const result = {
      success: true,
      message: '일괄 업데이트, 삭제, 정렬 및 중복 제거 완료',
      processed: {
        updated: players.length,
        deleted: deleted.length,
        deletedRows: rowsToDelete.length,
        duplicatesRemoved: cleanupResult.success ? (cleanupResult.message.includes('개') ? cleanupResult.message : '0개') : '실패'
      }
    };

    console.log(`[batchUpdate 완료] ${JSON.stringify(result)}`);
    return result;
  } catch (error) {
    console.error(`[batchUpdate 오류] ${error.toString()}`);
    console.error(`[batchUpdate 오류] Stack: ${error.stack}`);
    return {
      success: false,
      message: `오류: ${error.toString()}`,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    };
  }
}

// Type 시트 정렬 함수
function sortTypeSheet() {
  try {
    const sheet = _open().getSheetByName('Type');
    if (!sheet) return false;

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    // 헤더 행을 제외한 데이터 범위
    if (lastRow > 1) {
      const range = sheet.getRange(2, 1, lastRow - 1, lastCol);

      // 정렬 기준:
      // 1순위: Table (C열 = 3) - 오름차순
      // 2순위: Seat (G열 = 7) - 오름차순

      range.sort([
        {column: 3, ascending: true},  // Table: 오름차순
        {column: 7, ascending: true}   // Seat: 오름차순
      ]);
    }

    return true;
  } catch (error) {
    console.error('sortTypeSheet error:', error);
    return false;
  }
}

// 플레이어 삭제 (행 자체를 삭제)
function deletePlayer(playerName, tableName) {
  try {
    const sheet = _open().getSheetByName('Type');
    const data = sheet.getDataRange().getValues();

    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][TYPE_COLUMNS.PLAYER] === playerName &&
          data[i][TYPE_COLUMNS.TABLE] === tableName) {
        sheet.deleteRow(i + 1);
        return {success: true, message: `${playerName} 삭제 완료`};
      }
    }

    return {success: false, message: '플레이어를 찾을 수 없습니다'};
  } catch (error) {
    console.error('deletePlayer error:', error);
    return {success: false, message: error.toString()};
  }
}

// ===== 기존 v56 핸드 편집 기능 유지 =====

function updateHandEditStatus(handNumber, checked) {
  try {
    const spreadsheet = _open();
    const indexSheet = spreadsheet.getSheetByName('Index');
    
    if (!indexSheet) {
      throw new Error('Index 시트를 찾을 수 없습니다');
    }
    
    const data = indexSheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(handNumber)) {
        indexSheet.getRange(i + 1, 5).setValue(checked ? 'TRUE' : 'FALSE');
        indexSheet.getRange(i + 1, 6).setValue(new Date());
        
        return {
          success: true,
          handNumber: handNumber,
          checked: checked,
          updatedAt: new Date().toISOString()
        };
      }
    }
    
    throw new Error(`핸드 #${handNumber}를 찾을 수 없습니다`);
    
  } catch (error) {
    console.error('updateHandEditStatus 오류:', error);
    return {
      success: false,
      message: error.message
    };
  }
}

// ===== 기존 핸드 저장 함수들 (v56 유지) =====

function _padRows(rows) {
  let maxCols = 0;
  for (const row of rows) {
    maxCols = Math.max(maxCols, (row || []).length);
  }
  
  return rows.map(row => {
    const arr = (row || []).slice();
    while (arr.length < maxCols) {
      arr.push('');
    }
    return arr;
  });
}

function _normalizeEventRows(rows) {
  if (!Array.isArray(rows)) return rows;
  
  const output = [];
  const SIMPLE_EVENTS = {
    'FOLDS': 'FOLD',
    'CHECKS': 'CHECK',
    'CALLS': 'CALL',
    'BETS': 'BET'
  };
  
  for (const row of rows) {
    const r = (row || []).slice();
    
    if (r[1] === 'EVENT') {
      let eventType = String(r[2] || '').trim().toUpperCase();
      
      if (/^(RAISE|RAISES|RAISE TO|RAIES)$/.test(eventType)) {
        eventType = 'RAISE TO';
      }
      else if (SIMPLE_EVENTS[eventType]) {
        eventType = SIMPLE_EVENTS[eventType];
      }
      
      r[2] = eventType;
    }
    
    output.push(r);
  }
  
  return output;
}

function _ensureIndexHeader(sheet) {
  const fullHeaderRow = [
    'handNumber', 'startRow', 'endRow', 'handUpdatedAt', 
    'handEdit', 'handEditTime', 'label', 'table', 
    'tableUpdatedAt', 'Cam', 'CamFile01name', 'CamFile01number',
    'CamFile02name', 'CamFile02number',
    'lastStreet', 'lastAction', 'workStatus', 'winners'
  ];
  
  if (sheet.getLastRow() < 1) {
    sheet.getRange(1, 1, 1, fullHeaderRow.length).setValues([fullHeaderRow]);
  } else {
    const lastCol = sheet.getLastColumn();
    if (lastCol < 18) {  // 17에서 18로 변경 (winners 열 추가)
      sheet.getRange(1, 1, 1, fullHeaderRow.length).setValues([fullHeaderRow]);
    }
  }
}

// ===== 메인 핸들러 =====

function doGet(e) {
  return _json({
    status: 'ok',
    method: 'GET',
    time: new Date().toISOString(),
    version: 'v59-inout'
  });
}

function doPost(e) {
  try {
    const body = _parseRequestBody(e) || {};

    // 액션 기반 라우팅
    if (body.action) {
      switch(body.action) {
        // 테이블 관리
        case 'getTableList':
          return _json(getTableList());

        // 플레이어 관리
        case 'getPlayersByTable':
          return _json(getPlayersByTable(body.tableName));

        case 'upsertPlayer':
          return _json(upsertPlayer(body.playerData));

        case 'cashOutPlayer':
          return _json(cashOutPlayer(body.playerName, body.tableName, body.finalChips));

        case 'deletePlayer':
          return _json(deletePlayer(body.player, body.table));

        case 'addPlayer':
          return _json(addPlayer({
            name: body.player,
            table: body.table,
            seat: body.seat,
            chips: body.chips,
            status: body.status || 'IN'
          }));

        case 'updateSeat':
          return _json(updatePlayerSeat(body.player, body.table, body.seat));

        case 'updateChips':
          return _json(updatePlayerChips(body.player, body.table, body.chips));

        case 'batchUpdate':
          return _json(batchUpdatePlayers(body.table, body.players, body.deleted));

        case 'sortSheet':
          const sortResult = sortTypeSheet();
          return _json({
            success: sortResult,
            message: sortResult ? '시트 정렬 완료' : '정렬 실패'
          });

        case 'removeDuplicates':
          return _json(removeDuplicatePlayers());

        // v56 기능
        case 'updateHandEdit':
          return _json(updateHandEditStatus(body.handNumber, body.checked));
        
        default:
          return _json({
            success: false,
            message: 'Unknown action: ' + body.action
          });
      }
    }
    
    // 기존 핸드 저장 로직 (action이 없는 경우)
    const rowsInput = body.rows;
    const indexMeta = body.indexMeta || {};
    const typeUpdates = Array.isArray(body.typeUpdates) ? body.typeUpdates : [];
    
    if (!Array.isArray(rowsInput) || !rowsInput.length) {
      return _json({
        status: 'error',
        message: 'rows 데이터가 누락되었습니다.'
      });
    }
    
    const rows = _padRows(_normalizeEventRows(rowsInput));
    
    let handNumber = '';
    for (const row of rows) {
      if (row[1] === 'HAND') {
        handNumber = String(row[2] || '');
        break;
      }
    }
    
    const spreadsheet = _open();
    const handSheet = spreadsheet.getSheetByName('Hand') || spreadsheet.insertSheet('Hand');
    const indexSheet = spreadsheet.getSheetByName('Index') || spreadsheet.insertSheet('Index');
    const typeSheet = spreadsheet.getSheetByName('Type') || spreadsheet.insertSheet('Type');
    
    // Hand 시트에 데이터 기록
    const startRow = handSheet.getLastRow() + 1;
    handSheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
    const endRow = startRow + rows.length - 1;
    
    // Index 시트 업데이트
    _ensureIndexHeader(indexSheet);
    
    // 중복 체크
    const existingData = indexSheet.getDataRange().getValues();
    for (let i = 1; i < existingData.length; i++) {
      if (String(existingData[i][0]) === String(handNumber)) {
        return _json({
          status: 'duplicate',
          message: `핸드 #${handNumber}는 이미 기록되어 있습니다`,
          handNumber: handNumber,
          existingRow: i + 1
        });
      }
    }
    
    const rawDate = indexMeta.handUpdatedAt || new Date().toISOString();
    const updatedAt = String(rawDate).split('T')[0];
    const editTime = new Date();
    
    const indexData = [
      handNumber || String(indexMeta.handNumber || ''),
      startRow,
      endRow,
      updatedAt,
      '',
      editTime,
      indexMeta.label || '',
      indexMeta.table || '',
      indexMeta.tableUpdatedAt || updatedAt,
      indexMeta.cam || '',
      indexMeta.camFile01name || '',
      indexMeta.camFile01number || '',
      indexMeta.camFile02name || '',
      indexMeta.camFile02number || '',
      indexMeta.lastStreet || 'preflop',
      indexMeta.lastAction || '',
      indexMeta.workStatus || '진행중',
      indexMeta.winners || ''  // R열: 승자 정보 추가
    ];
    
    indexSheet.appendRow(indexData);
    
    // Type 시트 업데이트 (칩 정보)
    if (typeUpdates.length > 0) {
      const typeData = typeSheet.getDataRange().getValues();
      
      typeUpdates.forEach(update => {
        // Type 시트에서 플레이어 찾기 (Player와 Table 매칭)
        const rowIndex = typeData.findIndex((row, idx) => {
          return idx > 0 && 
                 row[TYPE_COLUMNS.PLAYER] === update.player && 
                 row[TYPE_COLUMNS.TABLE] === update.table;
        });
        
        if (rowIndex > 0) {
          // 칩 업데이트 (E열)
          typeSheet.getRange(rowIndex + 1, RANGE_COLUMNS.CHIPS).setValue(update.chips || 0);
          // UpdatedAt 업데이트 (F열)
          const updateTime = update.updatedAt ? new Date(update.updatedAt) : new Date();
          typeSheet.getRange(rowIndex + 1, RANGE_COLUMNS.UPDATED_AT).setValue(updateTime);
          
          // Status가 OUT인 경우 IN으로 변경 (플레이어가 다시 활동 중)
          const currentStatus = typeData[rowIndex][TYPE_COLUMNS.STATUS];
          if (currentStatus === 'OUT' || !currentStatus) {
            typeSheet.getRange(rowIndex + 1, RANGE_COLUMNS.STATUS).setValue('IN');
          }
          
          console.log(`Type 시트 업데이트: ${update.player} - ${update.chips} 칩`);
        } else {
          // 플레이어가 Type 시트에 없는 경우 새로 추가
          console.log(`Type 시트에 ${update.player} 추가`);
          const newRow = new Array(8);
          newRow[TYPE_COLUMNS.CAMERA] = '';
          newRow[TYPE_COLUMNS.PLAYER] = update.player;
          newRow[TYPE_COLUMNS.TABLE] = update.table;
          newRow[TYPE_COLUMNS.NOTABLE] = 'FALSE';
          newRow[TYPE_COLUMNS.CHIPS] = update.chips || 0;
          newRow[TYPE_COLUMNS.UPDATED_AT] = new Date();
          newRow[TYPE_COLUMNS.SEAT] = '';
          newRow[TYPE_COLUMNS.STATUS] = 'IN';
          
          typeSheet.appendRow(newRow);
        }
      });
    }
    
    return _json({
      status: 'success',
      handNumber: handNumber || indexMeta.handNumber || '',
      rowsAdded: rows.length,
      startRow: startRow,
      endRow: endRow,
      updatedAt: updatedAt,
      version: 'v59-inout'
    });
    
  } catch (error) {
    console.error('Error in doPost:', error);
    return _json({
      status: 'error',
      message: error.toString()
    });
  }
}

// ===== 테스트 함수 =====

function testInOutSystem() {
  console.log('=== IN/OUT 시스템 테스트 ===');
  
  // 1. 테이블 목록 조회
  const tables = getTableList();
  console.log('1. 테이블 목록:', tables);
  
  // 2. 플레이어 추가
  const newPlayer = upsertPlayer({
    name: 'Test Player',
    table: 'Test Table',
    chips: 100000,
    seat: 1,
    notable: true
  });
  console.log('2. 플레이어 추가:', newPlayer);
  
  // 3. 테이블별 플레이어 조회
  const players = getPlayersByTable('Test Table');
  console.log('3. 플레이어 목록:', players);
  
  // 4. 캐시아웃
  const cashOut = cashOutPlayer('Test Player', 'Test Table', 150000);
  console.log('4. 캐시아웃:', cashOut);
  
  console.log('=== 테스트 완료 ===');
}