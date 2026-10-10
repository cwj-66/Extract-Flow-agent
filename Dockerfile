FROM python:3.12-slim-bookworm

WORKDIR /app

# 4GB 服务器默认使用云端；需要本地解析时显式构建重依赖镜像。
ARG INSTALL_LOCAL_MINERU=false

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV FLAGS_use_mkldnn=0
ENV HF_HUB_DISABLE_SYMLINKS_WARNING=1

RUN set -eux; \
    if [ "$INSTALL_LOCAL_MINERU" != "true" ]; then exit 0; fi; \
    if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
      sed -i 's|http://deb.debian.org|http://mirrors.aliyun.com|g; s|https://deb.debian.org|http://mirrors.aliyun.com|g; s|http://security.debian.org|http://mirrors.aliyun.com|g; s|https://security.debian.org|http://mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources; \
    else \
      sed -i 's|http://deb.debian.org|http://mirrors.aliyun.com|g; s|https://deb.debian.org|http://mirrors.aliyun.com|g; s|http://security.debian.org|http://mirrors.aliyun.com|g; s|https://security.debian.org|http://mirrors.aliyun.com|g' /etc/apt/sources.list; \
    fi; \
    apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-api.txt ./
RUN pip install --no-cache-dir -i https://mirrors.aliyun.com/pypi/simple/ \
    --trusted-host mirrors.aliyun.com \
    -r requirements-api.txt

COPY my_project/pyproject.toml ./my_project/
COPY README.md ./my_project/README.md
RUN if [ "$INSTALL_LOCAL_MINERU" = "true" ]; then \
    pip install --no-cache-dir -i https://mirrors.aliyun.com/pypi/simple/ \
    --trusted-host mirrors.aliyun.com \
    ./my_project; \
    fi

COPY app ./app
COPY main.py ./

RUN mkdir -p data/uploads

EXPOSE 8000

CMD ["uvicorn", "app.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
