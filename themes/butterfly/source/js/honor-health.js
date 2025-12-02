/**
 * 荣耀运动健康 API 集成
 * 文档: https://developer.honor.com/cn/docs/11005/guides/code-guide/web/request-sampleData
 */

const HonorHealthConfig = {
  // TODO: 请填写你的荣耀开发者 APP_ID
  APP_ID: 'YOUR_APP_ID',
  // TODO: 请填写你的 APP_SECRET
  APP_SECRET: 'YOUR_APP_SECRET',
  // TODO: 请填写获取到的 Access Token
  ACCESS_TOKEN: 'YOUR_ACCESS_TOKEN',
  // API 基础地址
  API_BASE_URL: 'https://health-api.cloud.honor.com',
  // 是否使用模拟数据 (开发测试用)
  USE_MOCK_DATA: true
};

class HonorHealthManager {
  constructor() {
    this.config = HonorHealthConfig;
    this.heartrateChart = null;
    this.heartrateData = [];
    this.init();
  }

  init() {
    const container = document.querySelector('.card-health');
    if (!container) return;

    this.bindRefreshButton();
    this.loadData();
    // 每5分钟自动刷新
    setInterval(() => this.loadData(), 5 * 60 * 1000);
  }

  bindRefreshButton() {
    const btn = document.getElementById('health-refresh');
    if (btn) {
      btn.addEventListener('click', () => this.refreshData());
    }
  }

  async loadData() {
    try {
      const data = this.config.USE_MOCK_DATA 
        ? this.getMockData() 
        : await this.fetchHealthData();
      this.updateUI(data);
    } catch (error) {
      console.error('获取健康数据失败:', error);
      this.showError();
    }
  }

  getMockData() {
    // 生成今日心率数据 (从0点到现在)
    const now = new Date();
    const currentHour = now.getHours();
    const heartrateHistory = [];
    
    for (let h = 0; h <= currentHour; h++) {
      // 模拟不同时段的心率
      let baseRate;
      if (h >= 0 && h < 6) baseRate = 58; // 深夜睡眠
      else if (h >= 6 && h < 8) baseRate = 65; // 起床
      else if (h >= 8 && h < 12) baseRate = 75; // 上午
      else if (h >= 12 && h < 14) baseRate = 80; // 午餐后
      else if (h >= 14 && h < 18) baseRate = 72; // 下午
      else if (h >= 18 && h < 21) baseRate = 78; // 晚间
      else baseRate = 65; // 夜间

      heartrateHistory.push({
        hour: h,
        value: baseRate + Math.floor(Math.random() * 10) - 5
      });
    }

    // 当前心率
    const currentHeartrate = heartrateHistory.length > 0 
      ? heartrateHistory[heartrateHistory.length - 1].value 
      : 72;

    // 模拟睡眠数据
    const sleepStart = '23:30';
    const sleepEnd = '07:15';
    
    // 当前是否清醒 (简单判断: 7点-23点为清醒)
    const isAwake = currentHour >= 7 && currentHour < 23;

    return {
      heartrate: currentHeartrate,
      heartrateHistory,
      sleepStart,
      sleepEnd,
      isAwake,
      steps: Math.floor(Math.random() * 8000) + 2000,
      updateTime: new Date()
    };
  }

  async fetchHealthData() {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.ACCESS_TOKEN}`
    };

    const today = new Date();
    const startTime = new Date(today.setHours(0, 0, 0, 0)).getTime();
    const endTime = Date.now();

    const [heartrateData, sleepData, stepsData] = await Promise.all([
      this.fetchHeartrate(headers, startTime, endTime),
      this.fetchSleep(headers, startTime, endTime),
      this.fetchSteps(headers, startTime, endTime)
    ]);

    return {
      heartrate: heartrateData.current || '--',
      heartrateHistory: heartrateData.history || [],
      sleepStart: sleepData.startTime || '--:--',
      sleepEnd: sleepData.endTime || '--:--',
      isAwake: sleepData.isAwake !== false,
      steps: stepsData.count || '--',
      updateTime: new Date()
    };
  }

  async fetchHeartrate(headers, startTime, endTime) {
    try {
      const response = await fetch(`${this.config.API_BASE_URL}/v1/health/heartrate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ startTime, endTime, dataType: 'heartrate' })
      });
      const data = await response.json();
      
      if (data.data && data.data.length > 0) {
        const history = this.processHeartrateData(data.data);
        const current = data.data[data.data.length - 1].heartRate;
        return { current, history };
      }
      return { current: null, history: [] };
    } catch (e) {
      console.error('获取心率失败:', e);
      return { current: null, history: [] };
    }
  }

  processHeartrateData(rawData) {
    // 按小时聚合心率数据
    const hourlyData = {};
    rawData.forEach(item => {
      const hour = new Date(item.timestamp).getHours();
      if (!hourlyData[hour]) {
        hourlyData[hour] = [];
      }
      hourlyData[hour].push(item.heartRate);
    });

    // 计算每小时平均值
    return Object.entries(hourlyData).map(([hour, values]) => ({
      hour: parseInt(hour),
      value: Math.round(values.reduce((a, b) => a + b, 0) / values.length)
    })).sort((a, b) => a.hour - b.hour);
  }

  async fetchSleep(headers, startTime, endTime) {
    try {
      const response = await fetch(`${this.config.API_BASE_URL}/v1/health/sleep`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ startTime, endTime, dataType: 'sleep' })
      });
      const data = await response.json();
      
      if (data.data && data.data.length > 0) {
        const latest = data.data[data.data.length - 1];
        return {
          startTime: this.formatTime(latest.sleepStartTime),
          endTime: this.formatTime(latest.sleepEndTime),
          isAwake: latest.sleepStatus === 1
        };
      }
      return { startTime: null, endTime: null, isAwake: true };
    } catch (e) {
      console.error('获取睡眠数据失败:', e);
      return { startTime: null, endTime: null, isAwake: true };
    }
  }

  async fetchSteps(headers, startTime, endTime) {
    try {
      const response = await fetch(`${this.config.API_BASE_URL}/v1/health/steps`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ startTime, endTime, dataType: 'steps' })
      });
      const data = await response.json();
      
      if (data.data && data.data.length > 0) {
        const totalSteps = data.data.reduce((sum, item) => sum + item.steps, 0);
        return { count: totalSteps };
      }
      return { count: null };
    } catch (e) {
      console.error('获取步数失败:', e);
      return { count: null };
    }
  }

  formatTime(timestamp) {
    if (!timestamp) return '--:--';
    const date = new Date(timestamp);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  updateUI(data) {
    // 更新心率
    const heartrateEl = document.getElementById('heartrate-value');
    if (heartrateEl) {
      heartrateEl.textContent = data.heartrate;
    }

    // 更新心率折线图
    this.updateHeartrateChart(data.heartrateHistory);

    // 更新睡眠时间
    const sleepStartEl = document.getElementById('sleep-start');
    const sleepEndEl = document.getElementById('sleep-end');
    if (sleepStartEl) sleepStartEl.textContent = data.sleepStart;
    if (sleepEndEl) sleepEndEl.textContent = data.sleepEnd;

    // 更新睡眠状态
    const sleepStatusEl = document.getElementById('sleep-status');
    if (sleepStatusEl) {
      sleepStatusEl.className = `sleep-status ${data.isAwake ? 'awake' : 'sleeping'}`;
      sleepStatusEl.innerHTML = `<i class="fas fa-circle"></i><span>${data.isAwake ? '清醒' : '睡眠中'}</span>`;
    }

    // 更新步数
    const stepsEl = document.getElementById('health-steps');
    if (stepsEl) {
      stepsEl.textContent = typeof data.steps === 'number' ? data.steps.toLocaleString() : data.steps;
    }

    // 更新时间
    const updateTimeEl = document.getElementById('health-update-time');
    if (updateTimeEl) {
      const time = data.updateTime instanceof Date
        ? data.updateTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        : '--:--';
      updateTimeEl.textContent = `更新于 ${time}`;
    }
  }

  updateHeartrateChart(historyData) {
    const canvas = document.getElementById('heartrate-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.parentElement.offsetWidth;
    const height = 60;
    
    canvas.width = width * 2;
    canvas.height = height * 2;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.scale(2, 2);

    ctx.clearRect(0, 0, width, height);

    if (!historyData || historyData.length < 2) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('暂无数据', width / 2, height / 2);
      return;
    }

    const values = historyData.map(d => d.value);
    const minVal = Math.min(...values) - 5;
    const maxVal = Math.max(...values) + 5;
    const range = maxVal - minVal || 1;

    const padding = { left: 5, right: 5, top: 8, bottom: 15 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // 绘制渐变填充
    const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    gradient.addColorStop(0, 'rgba(255,255,255,0.3)');
    gradient.addColorStop(1, 'rgba(255,255,255,0.05)');

    ctx.beginPath();
    historyData.forEach((point, i) => {
      const x = padding.left + (i / (historyData.length - 1)) * chartWidth;
      const y = padding.top + (1 - (point.value - minVal) / range) * chartHeight;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    
    // 闭合填充区域
    ctx.lineTo(padding.left + chartWidth, height - padding.bottom);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // 绘制折线
    ctx.beginPath();
    historyData.forEach((point, i) => {
      const x = padding.left + (i / (historyData.length - 1)) * chartWidth;
      const y = padding.top + (1 - (point.value - minVal) / range) * chartHeight;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 绘制当前点
    const lastPoint = historyData[historyData.length - 1];
    const lastX = padding.left + chartWidth;
    const lastY = padding.top + (1 - (lastPoint.value - minVal) / range) * chartHeight;
    
    ctx.beginPath();
    ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    // 绘制时间标签
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('0时', padding.left, height - 2);
    ctx.textAlign = 'right';
    ctx.fillText('现在', width - padding.right, height - 2);
  }

  showError() {
    const updateTimeEl = document.getElementById('health-update-time');
    if (updateTimeEl) {
      updateTimeEl.textContent = '数据获取失败';
    }
  }

  async refreshData() {
    const btn = document.getElementById('health-refresh');
    if (btn) btn.classList.add('loading');
    
    await this.loadData();
    
    setTimeout(() => {
      if (btn) btn.classList.remove('loading');
    }, 500);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new HonorHealthManager();
});
