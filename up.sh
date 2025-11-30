#!/bin/bash
echo "🚀 开始自动部署..."
git add .
git commit -m "auto update: $(date)"
git push
echo "✅ 搞定！坐等 Vercel 变绿吧！"