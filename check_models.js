// 替换成你的真实 Key
const apiKey = "AIzaSyAgNxIlBwvo5xc5LUfpHyPU4v5tfkOg9w0"; 

async function checkModels() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error) {
      console.error("❌ 查询失败:", data.error.message);
      return;
    }

    console.log("✅ 你的 API Key 支持以下生成模型：");
    console.log("------------------------------------------------");
    
    const chatModels = data.models.filter(m => 
      m.supportedGenerationMethods.includes("generateContent")
    );

    chatModels.forEach(model => {
      // 输出模型名字，去掉前面的 'models/' 前缀，方便你直接复制
      console.log(`Model Name: ${model.name.replace('models/', '')}`);
    });
    
    console.log("------------------------------------------------");

  } catch (error) {
    console.error("网络错误:", error);
  }
}

checkModels();