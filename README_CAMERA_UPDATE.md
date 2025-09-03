# 카메라 정보 일괄 업데이트 가이드

## 1. 목적
기존 Index 시트에 카메라 정보가 비어있는 핸드들에 대해 자동으로 카메라 파일명과 번호를 채워넣는 1회성 작업 도구입니다.

## 2. 사용 방법

### Step 1: Apps Script 업데이트
1. [Google Apps Script](https://script.google.com)로 이동
2. 기존 포커 핸드 로거 프로젝트 열기
3. `apps_script_camera_update.gs` 파일의 코드를 기존 `doPost` 함수의 switch 문에 추가

### Step 2: HTML 파일 실행
1. `update_camera_info.html` 파일을 브라우저에서 열기
2. "데이터 확인" 버튼 클릭 - 현재 시트 상태 확인
3. "미리보기" 버튼 클릭 - 업데이트될 내용 확인
4. "실행" 버튼 클릭 - 실제 업데이트 수행

## 3. 작동 원리
- Type 시트의 A2, A3 셀에서 카메라 이름 가져옴 (예: Cam1, Cam2)
- Index 시트에서 카메라 정보가 비어있는 행 찾기
- 순차적으로 번호 할당 (0001, 0002, 0003...)
- 각 핸드마다:
  - J열: "Cam1+Cam2" 형식
  - K열: Cam1 이름
  - L열: 카메라1 번호 (0001)
  - M열: Cam2 이름  
  - N열: 카메라2 번호 (0002)

## 4. 설정 옵션
- **시작 번호**: 카메라 번호 시작값 (기본: 1)
- **번호 증가 간격**: Cam2 = Cam1 + 이 값 (기본: 1)

## 5. 주의사항
- 실행 전 Google Sheets 백업 권장
- 이미 카메라 정보가 있는 행은 건너뜀
- 한 번 업데이트하면 되돌리기 어려움

## 6. 파일 구조
```
virtual_data/
├── index.html                    # 메인 포커 핸드 로거
├── update_camera_info.html       # 카메라 정보 일괄 업데이트 도구
├── apps_script_camera_update.gs  # Apps Script 추가 코드
└── README_CAMERA_UPDATE.md       # 이 문서
```

## 7. 문제 해결
- **"오류: 권한 없음"**: Apps Script URL 확인
- **"업데이트할 행 없음"**: Index 시트에 이미 모든 카메라 정보가 있음
- **번호가 이상함**: 시작 번호와 증가 간격 설정 확인