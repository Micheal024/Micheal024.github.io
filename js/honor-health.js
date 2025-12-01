/**
 * 荣耀运动健康 API 集成
 * 文档: https://developer.honor.com/cn/docs/11005/guides/code-guide/web/request-sampleData
 * 
 * 使用前需要:
 * 1. 在荣耀开发者平台申请 APP_ID 和 APP_SECRET
 * 2. 配置回调地址获取用户授权
 * 3. 填写下方配置信息
 */

const HonorHealthConfig = {
  // TODO: 请填写你的荣耀开发者 APP_ID
  APP_ID: 'YOUR_APP_ID',
  // TODO: 请填写你的 APP_SECRET (建议通过后端接口获取，不要暴露在前端)
  APP_SECRET: 'YOUR_APP_SECRET',
  // TODO: 请填写获取到的 Access Token (建议通过后端接口获取)
  ACCESS_TOKEN: 'YOUR_ACCESS_TOKEN',
  // API 基础地址
  API_BASE_URL: 'https://health-api.cloud.honor.com',
  // 是否使用模拟数据 (开发测试用)
  USE_MOCK_DATA: true
};

/**
 * 荣耀健康数据管理类
 */
class HonorHealthManager {
  constructor() {
    this.config = HonorHealthConfig;
    this.elements = {
      heartrate: document.getElementById('health-heartrate'),
      sleep: document.getElementById('health-sleep'),
      sleepStatus: document.getElementById('health-sleep-status'),
      steps: document.getElementById('health-steps'),
      updateTime: document.getElementById('health-update-time'),
      refreshBtn: document.getElementById('health-refresh')
    };
    this.init();
  }

  init() {
    if (!this.elements.heartrate) return;
    
    // 绑定刷新按钮
    if (this.elements.refreshBtn) {
      this.elements.refreshBtn.addEventListener('click', () => this.refreshData());
    }
    
    // 初始加载数据
    this.loadData();
    
    // 每5分钟自动刷新
    setInterval(() => this.loadData(), 5 * 60 * 1000);
  }

  async loadData() {
    try {
      if (this.config.USE_MOCK_DATA) {
        // 使用模拟数据
        this.updateUI(this.getMockData());
      } else {
        // 调用真实 API
        const data = await this.fetchHealthData();
        this.updateUI(data);
      }
    } catch (error) {
      console.error('获取健康数据失败:', error);
      this.showError();
    }
  }

  /**
   * 获取模拟数据 (开发测试用)
   */
  getMockData() {
    return {
      heartrate: Math.floor(Math.random() * 30) + 60, // 60-90
      sleepHours: (Math.random() * 3 + 6).toFixed(1), // 6-9小时
      sleepStatus: ['深睡', '浅睡', '清醒', 'REM'][Math.floor(Math.random() * 4)],
      steps: Math.floor(Math.random() * 8000) + 2000, // 2000-10000步
      updateTime: new Date()
    };
  }

  /**
   * 调用荣耀健康 API 获取数据
   * 参考文档: https://developer.honor.com/cn/docs/11005/guides/code-guide/web/request-sampleData
   */
  async fetchHealthData() {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.ACCESS_TOKEN}`
    };

    // 获取今天的日期范围
    const today = new Date();
    const startTime = new Date(today.setHours(0, 0, 0, 0)).getTime();
    const endTime = Date.now();

    // 并行请求各项数据
    const [heartrateData, sleepData, stepsData] = await Promise.all([
      this.fetchHeartrate(headers, startTime, endTime),
      this.fetchSleep(headers, startTime, endTime),
      this.fetchSteps(headers, startTime, endTime)
    ]);

    return {
      heartrate: heartrateData.value || '--',
      sleepHours: sleepData.duration || '--',
      sleepStatus: sleepData.status || '--',
      steps: stepsData.count || '--',
      updateTime: new Date()
    };
  }

  /**
   * 获取心率数据
   */
  async fetchHeartrate(headers, startTime, endTime) {
    try {
      const response = await fetch(`${this.config.API_BASE_URL}/v1/health/heartrate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          startTime,
          endTime,
          dataType: 'heartrate'
        })
      });
      const data = await response.json();
      // 返回最新的心率值
      if (data.data && data.data.length > 0) {
        const latest = data.data[data.data.length - 1];
        return { value: latest.heartRate };
      }
      return { value: null };
    } catch (e) {
      console.error('获取心率失败:', e);
      return { value: null };
    }
  }

  /**
   * 获取睡眠数据
   */
  async fetchSleep(headers, startTime, endTime) {
    try {
      const response = await fetch(`${this.config.API_BASE_URL}/v1/health/sleep`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          startTime,
          endTime,
          dataType: 'sleep'
        })
      });
      const data = await response.json();
      if (data.data && data.data.length > 0) {
        const latest = data.data[data.data.length - 1];
        const durationHours = (latest.duration / 3600000).toFixed(1);
        return {
          duration: durationHours,
          status: this.getSleepStatusText(latest.sleepStatus)
        };
      }
      return { duration: null, status: null };
    } catch (e) {
      console.error('获取睡眠数据失败:', e);
      return { duration: null, status: null };
    }
  }

  /**
   * 获取步数数据
   */
  async fetchSteps(headers, startTime, endTime) {
    try {
      const response = await fetch(`${this.config.API_BASE_URL}/v1/health/steps`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          startTime,
          endTime,
          dataType: 'steps'
        })
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

  /**
   * 睡眠状态码转文字
   */
  getSleepStatusText(status) {
    const statusMap = {
      1: '清醒',
      2: '浅睡',
      3: '深睡',
      4: 'REM'
    };
    return statusMap[status] || '未知';
  }

  /**
   * 更新界面显示
   */
  updateUI(data) {
    if (this.elements.heartrate) {
      this.elements.heartrate.querySelector('.value').textContent = data.heartrate;
    }
    if (this.elements.sleep) {
      this.elements.sleep.querySelector('.value').textContent = data.sleepHours;
    }
    if (this.elements.sleepStatus) {
      this.elements.sleepStatus.querySelector('.value').textContent = data.sleepStatus;
    }
    if (this.elements.steps) {
      this.elements.steps.querySelector('.value').textContent = 
        typeof data.steps === 'number' ? data.steps.toLocaleString() : data.steps;
    }
    if (this.elements.updateTime) {
      const time = data.updateTime instanceof Date 
        ? data.updateTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        : '--:--';
      this.elements.updateTime.textContent = `更新于 ${time}`;
    }
  }

  /**
   * 显示错误状态
   */
  showError() {
    if (this.elements.updateTime) {
      this.elements.updateTime.textContent = '数据获取失败';
    }
  }

  /**
   * 刷新数据
   */
  async refreshData() {
    const btn = this.elements.refreshBtn;
    if (btn) {
      btn.classList.add('loading');
    }
    
    await this.loadData();
    
    setTimeout(() => {
      if (btn) {
        btn.classList.remove('loading');
      }
    }, 500);
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  new HonorHealthManager();
});
