javascript:(function(){
  // 서버 API 엔드포인트
  const API_URL = 'https://localhost:5000/api/detect-pii';
  // 이메일 파라미터 또는 로컬 스토리지에서 사용자 이메일 가져오기
  let userEmail = new URL(location.href).searchParams.get('email') || localStorage.getItem('user_email');
  
  // 스타일 추가
  const style = document.createElement('style');
  style.textContent = `
    .pii-alert {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background-color: #ff6b6b;
      color: white;
      padding: 15px;
      border-radius: 5px;
      z-index: 10000;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      max-width: 400px;
    }
    .pii-highlight {
      background-color: #ff6b6b;
      padding: 2px 4px;
      border-radius: 3px;
      position: relative;
    }
    .pii-options {
      position: absolute;
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      z-index: 10001;
      display: none;
    }
    .pii-options button {
      display: block;
      width: 100%;
      padding: 5px 10px;
      margin: 5px 0;
      border: none;
      background: #f0f0f0;
      border-radius: 3px;
      cursor: pointer;
    }
    .pii-options button:hover {
      background: #e0e0e0;
    }
    .pii-modal {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      z-index: 10002;
      width: 300px;
    }
    .pii-modal input {
      width: 100%;
      padding: 8px;
      margin: 10px 0;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    .pii-modal button {
      padding: 8px 15px;
      background: #4a90e2;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      margin-right: 10px;
    }
    .pii-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10001;
    }
  `;
  document.head.appendChild(style);
  
  // 입력창 찾기
  let inputBox = document.querySelector("div[contenteditable='true']");
  if (!inputBox) {
    showAlert("❌ 입력창을 찾을 수 없습니다. GPT 페이지에서 실행해주세요!");
    return;
  }
  
  // 이메일이 없는 경우 사용자에게 요청
  if (!userEmail) {
    showEmailModal();
  } else {
    // 이메일 유효성 검증
    validateEmail(userEmail).then(valid => {
      if (!valid) {
        localStorage.removeItem('user_email');
        showEmailModal();
      } else {
        showAlert("✅ 개인정보 감지 및 익명화 기능이 활성화되었습니다!");
      }
    });
  }
  
  // 이메일 입력 모달 표시
  function showEmailModal() {
    // 오버레이 생성
    const overlay = document.createElement('div');
    overlay.className = 'pii-overlay';
    document.body.appendChild(overlay);
    
    // 모달 생성
    const modal = document.createElement('div');
    modal.className = 'pii-modal';
    modal.innerHTML = `
      <h3>개인정보 보호 도구 인증</h3>
      <p>이메일을 입력해주세요:</p>
      <input type="email" id="email-input" placeholder="example@example.com">
      <div>
        <button id="login-btn">인증</button>
        <button id="cancel-btn">취소</button>
      </div>
    `;
    document.body.appendChild(modal);
    
    // 버튼 이벤트 설정
    document.getElementById('login-btn').addEventListener('click', () => {
      const email = document.getElementById('email-input').value.trim();
      if (email && isValidEmailFormat(email)) {
        validateEmail(email).then(valid => {
          if (valid) {
            userEmail = email;
            localStorage.setItem('user_email', email);
            modal.remove();
            overlay.remove();
            showAlert("✅ 개인정보 감지 및 익명화 기능이 활성화되었습니다!");
          } else {
            showAlert("❌ 등록되지 않은 이메일입니다.");
          }
        });
      } else {
        showAlert("❌ 올바른 이메일 형식을 입력해주세요.");
      }
    });
    
    document.getElementById('cancel-btn').addEventListener('click', () => {
      modal.remove();
      overlay.remove();
    });
  }
  
  // 이메일 형식 확인 (기본 검증)
  function isValidEmailFormat(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }
  
  // 이메일 유효성 검증 (서버 측)
  async function validateEmail(email) {
    try {
      const response = await fetch(`${API_URL}/validate-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });
      return response.ok;
    } catch (error) {
      console.error('이메일 검증 오류:', error);
      return false;
    }
  }
  
  // 패턴을 이용한 기본 개인정보 감지 (API 호출 전 1차 감지)
  function localCheckSensitiveInfo(text) {
    const patterns = [
      { pattern: /\b\d{2,3}-\d{3,4}-\d{4}\b/, type: 'PHONE' },  // 전화번호 (010-1234-5678)
      { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, type: 'EMAIL' },  // 이메일
      { pattern: /\b\d{6}-[1-4]\d{6}\b/, type: 'SSN' },  // 주민등록번호 (앞6자리-뒤7자리)
      { pattern: /\b\d{4}-\d{4}-\d{4}-\d{4}\b/, type: 'CREDIT_DEBIT_NUMBER' }  // 신용카드 번호
    ];
    
    const matches = [];
    for (let item of patterns) {
      const regex = new RegExp(item.pattern, 'g');
      let match;
      while ((match = regex.exec(text)) !== null) {
        matches.push({
          type: item.type,
          value: match[0],
          index: match.index,
          length: match[0].length
        });
      }
    }
    
    return matches;
  }
  
  // API를 이용한 개인정보 감지
  async function detectPIIWithAPI(text) {
    try {
      // 이메일이 없으면 API 호출 안함
      if (!userEmail) {
        return { detected_types: [], sensitivity_levels: [] };
      }
      
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          text,
          email: userEmail 
        })
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          // 인증 실패한 경우
          localStorage.removeItem('user_email');
          showEmailModal();
          throw new Error('인증에 실패했습니다. 이메일을 다시 입력해주세요.');
        }
        throw new Error(`API 응답 오류: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API 호출 오류:', error);
      showAlert(`⚠️ API 호출 중 오류: ${error.message}`);
      return { detected_types: [], sensitivity_levels: [] };
    }
  }
  
  // 알림 표시 함수
  function showAlert(message, duration = 5000) {
    let alertBox = document.querySelector('.pii-alert');
    
    if (!alertBox) {
      alertBox = document.createElement('div');
      alertBox.className = 'pii-alert';
      document.body.appendChild(alertBox);
    }
    
    alertBox.textContent = message;
    alertBox.style.display = 'block';
    
    setTimeout(() => {
      alertBox.style.display = 'none';
    }, duration);
  }
  
  // 텍스트 익명화 함수
  function anonymizeText(text, type) {
    switch(type) {
      case 'PHONE':
        return text.replace(/\d/g, '*').replace(/\*{3,4}-\*{3,4}-\*{4}/, '***-****-****');
      case 'EMAIL':
        const [username, domain] = text.split('@');
        return username.substring(0, 2) + '****@' + domain;
      case 'SSN':
        return text.substr(0, 8) + '******';
      case 'CREDIT_DEBIT_NUMBER':
        return text.replace(/\d{4}-\d{4}-\d{4}-\d{4}/, '****-****-****-****');
      case 'NAME':
        return '*' + '○'.repeat(text.length - 1);
      case 'ADDRESS':
        const parts = text.split(' ');
        return parts.map((part, index) => index === 0 ? part : '***').join(' ');
      default:
        return '******';
    }
  }
  
  // 입력창의 텍스트를 처리하고 개인정보 하이라이트 적용
  async function processAndHighlightText() {
    const text = inputBox.innerText;
    
    // 텍스트가 비어있으면 처리하지 않음
    if (!text.trim()) return;
    
    // 로컬에서 1차 검사
    const localMatches = localCheckSensitiveInfo(text);
    
    if (localMatches.length > 0) {
      showAlert(`⚠️ ${localMatches.length}개의 개인정보가 감지되었습니다. 하이라이트된 부분을 확인하세요.`);
      highlightPII(localMatches);
    }
    
    // 300ms 디바운싱 - 입력이 끝나면 API 호출
    clearTimeout(inputBox.apiTimer);
    inputBox.apiTimer = setTimeout(async () => {
      // 이메일이 있는 경우에만 API 호출
      if (userEmail) {
        // API를 통해 2차 검사
        const apiResult = await detectPIIWithAPI(text);
        
        if (apiResult.detected_types && apiResult.detected_types.length > 0) {
          showAlert(`⚠️ API 검사 결과: ${apiResult.detected_types.length}개의 추가 개인정보가 감지되었습니다.`);
          
          // API 결과를 토대로 추가 하이라이트 처리 가능
          // 이 부분은 API가 정확한 위치 정보를 반환한다는 가정하에 구현 필요
        }
      }
    }, 300);
  }
  
  // 개인정보 하이라이트 및 익명화 옵션 제공
  function highlightPII(matches) {
    // 원본 텍스트 백업
    const originalText = inputBox.innerHTML;
    
    // 새로운 HTML 생성
    let newHTML = originalText;
    
    // 뒤에서부터 처리하여 인덱스 변화 방지
    matches.sort((a, b) => b.index - a.index);
    
    for (const match of matches) {
      const startIdx = findPositionInHTML(newHTML, match.index);
      const endIdx = startIdx + match.value.length;
      
      // 하이라이트 요소 생성
      const highlightSpan = `<span class="pii-highlight" data-pii-type="${match.type}" data-pii-value="${match.value}">${match.value}
        <div class="pii-options">
          <button class="pii-anonymize">익명화</button>
          <button class="pii-remove">삭제</button>
          <button class="pii-ignore">무시</button>
        </div>
      </span>`;
      
      // HTML 업데이트
      newHTML = newHTML.substring(0, startIdx) + highlightSpan + newHTML.substring(endIdx);
    }
    
    // 새 HTML 적용
    inputBox.innerHTML = newHTML;
    
    // 이벤트 리스너 추가
    document.querySelectorAll('.pii-highlight').forEach(highlight => {
      highlight.addEventListener('click', function(e) {
        e.stopPropagation();
        // 옵션 표시/숨김 토글
        const options = this.querySelector('.pii-options');
        options.style.display = options.style.display === 'block' ? 'none' : 'block';
      });
    });
    
    // 익명화 버튼 이벤트
    document.querySelectorAll('.pii-anonymize').forEach(button => {
      button.addEventListener('click', function(e) {
        e.stopPropagation();
        const highlight = this.closest('.pii-highlight');
        const type = highlight.getAttribute('data-pii-type');
        const value = highlight.getAttribute('data-pii-value');
        const anonymized = anonymizeText(value, type);
        
        // 익명화된 텍스트로 교체
        highlight.innerHTML = anonymized;
        highlight.className = '';
        
        showAlert(`✅ 개인정보가 익명화되었습니다.`);
      });
    });
    
    // 삭제 버튼 이벤트
    document.querySelectorAll('.pii-remove').forEach(button => {
      button.addEventListener('click', function(e) {
        e.stopPropagation();
        const highlight = this.closest('.pii-highlight');
        highlight.remove();
        showAlert(`✅ 개인정보가 삭제되었습니다.`);
      });
    });
    
    // 무시 버튼 이벤트
    document.querySelectorAll('.pii-ignore').forEach(button => {
      button.addEventListener('click', function(e) {
        e.stopPropagation();
        const highlight = this.closest('.pii-highlight');
        const value = highlight.getAttribute('data-pii-value');
        
        // 기존 하이라이트 제거하고 일반 텍스트로 교체
        const textNode = document.createTextNode(value);
        highlight.parentNode.replaceChild(textNode, highlight);
        
        showAlert(`✅ 해당 정보는 무시되었습니다.`);
      });
    });
  }
  
  // HTML 내에서 텍스트 인덱스 찾기 (태그 제외)
  function findPositionInHTML(html, textIndex) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // HTML을 텍스트로 변환
    const textContent = tempDiv.textContent;
    
    // 원하는 위치의 문자
    const targetChar = textContent[textIndex];
    
    // HTML에서의 인덱스 계산
    let textCounter = 0;
    let htmlIndex = 0;
    
    while (textCounter <= textIndex && htmlIndex < html.length) {
      // 태그 시작 부분 건너뛰기
      if (html[htmlIndex] === '<') {
        while (htmlIndex < html.length && html[htmlIndex] !== '>') {
          htmlIndex++;
        }
        htmlIndex++; // '>' 문자 건너뛰기
      }
      // 특수 문자 처리
      else if (html[htmlIndex] === '&') {
        let entityEnd = html.indexOf(';', htmlIndex);
        if (entityEnd !== -1) {
          textCounter++;
          htmlIndex = entityEnd + 1;
        } else {
          textCounter++;
          htmlIndex++;
        }
      }
      // 일반 텍스트
      else {
        if (textCounter === textIndex) {
          break;
        }
        textCounter++;
        htmlIndex++;
      }
    }
    
    return htmlIndex;
  }
  
  // 디바운스 함수
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
  
  // 이벤트 리스너 설정
  const debouncedProcess = debounce(processAndHighlightText, 500);
  inputBox.addEventListener("input", debouncedProcess);
  
  // 문서 클릭 시 PII 옵션 닫기
  document.addEventListener('click', function() {
    document.querySelectorAll('.pii-options').forEach(opt => {
      opt.style.display = 'none';
    });
  });
  
  // 초기화 완료 메시지
  if (userEmail) {
    showAlert("✅ 개인정보 감지 및 익명화 기능이 활성화되었습니다!");
  }
})();
