"""固定研报提取模型与 LLM 提示词。"""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

_MISSING = "无"
_DEFAULT_FORECAST_YEARS = ("2026E", "2027E", "2028E")


class MetricPair(BaseModel):
    """数值 + 变动（如同比/较年初）。"""

    value: str = _MISSING
    change: str = ""

    @field_validator("value", "change", mode="before")
    @classmethod
    def _as_str(cls, v: object) -> str:
        if v is None:
            return ""
        return str(v).strip()


class BusinessSegment(BaseModel):
    """业务板块一行。"""

    name: str = _MISSING
    value: str = _MISSING
    growth: str = ""

    @field_validator("name", "value", "growth", mode="before")
    @classmethod
    def _as_str(cls, v: object) -> str:
        if v is None:
            return ""
        return str(v).strip()


class ProfitForecastRow(BaseModel):
    """盈利预测一行（单位：百万元）。"""

    year: str = _MISSING
    revenue: str = _MISSING
    net_profit: str = _MISSING

    @field_validator("year", "revenue", "net_profit", mode="before")
    @classmethod
    def _as_str(cls, v: object) -> str:
        if v is None:
            return ""
        return str(v).strip()


class ExtractionResult(BaseModel):
    """券商业绩点评研报固定提取结果（与飞书 Card v2 布局对齐）。"""

    company_name: str = _MISSING
    stock_code: str = _MISSING
    report_period: str = _MISSING
    rating: str = _MISSING
    revenue: MetricPair = Field(default_factory=MetricPair)
    net_profit: MetricPair = Field(default_factory=MetricPair)
    roe: MetricPair = Field(default_factory=MetricPair)
    total_assets: MetricPair = Field(default_factory=MetricPair)
    net_assets: MetricPair = Field(default_factory=MetricPair)
    business_segments: list[BusinessSegment] = Field(default_factory=list)
    profit_forecast: list[ProfitForecastRow] = Field(default_factory=list)
    core_view: str = _MISSING
    risks: str = _MISSING

    @field_validator(
        "company_name",
        "stock_code",
        "report_period",
        "rating",
        "core_view",
        "risks",
        mode="before",
    )
    @classmethod
    def _str_or_missing(cls, v: object) -> str:
        if v is None or (isinstance(v, str) and not v.strip()):
            return _MISSING
        return str(v).strip()

    @field_validator("revenue", "net_profit", "roe", "total_assets", "net_assets", mode="before")
    @classmethod
    def _coerce_metric(cls, v: object) -> object:
        if v is None or v == "" or v == _MISSING:
            return {"value": _MISSING, "change": ""}
        if isinstance(v, str):
            parts = [p.strip() for p in v.replace(",", "，").split("，", 1)]
            return {
                "value": parts[0] or _MISSING,
                "change": parts[1] if len(parts) > 1 else "",
            }
        return v

    @field_validator("business_segments", mode="before")
    @classmethod
    def _coerce_segments(cls, v: object) -> object:
        if v is None:
            return []
        return v

    @field_validator("profit_forecast", mode="before")
    @classmethod
    def _coerce_forecast(cls, v: object) -> object:
        if v is None:
            return []
        return v

    def model_post_init(self, __context: object) -> None:
        for m in (self.revenue, self.net_profit, self.roe, self.total_assets, self.net_assets):
            if not m.value:
                object.__setattr__(m, "value", _MISSING)
        if not self.profit_forecast:
            object.__setattr__(
                self,
                "profit_forecast",
                [ProfitForecastRow(year=y) for y in _DEFAULT_FORECAST_YEARS],
            )


class FieldEvidence(BaseModel):
    """单个字段在原文中的出处。start/end 为 Markdown 字符下标，未命中为 -1。"""

    field: str
    quote: str = ""
    start: int = -1
    end: int = -1
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class ExtractionMetrics(BaseModel):
    """一次 LLM 提取的成本与延迟。"""

    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    elapsed_ms: int = 0
    estimated_cny: float = 0.0
    retries: int = 0


class ExtractionMeta(BaseModel):
    """与 15 字段并列持久化的可观测信息。"""

    evidence: list[FieldEvidence] = Field(default_factory=list)
    metrics: ExtractionMetrics | None = None


class ExtractedDocument(BaseModel):
    """提取引擎完整产出。"""

    result: ExtractionResult
    meta: ExtractionMeta


def empty_extraction_result() -> ExtractionResult:
    return ExtractionResult()


def parse_llm_payload(data: dict) -> tuple[dict, dict[str, str]]:
    """兼容 {fields, evidence} 包装格式与旧的扁平字段 JSON。"""
    if isinstance(data.get("fields"), dict):
        quotes: dict[str, str] = {}
        raw_ev = data.get("evidence") or {}
        if isinstance(raw_ev, dict):
            for key, val in raw_ev.items():
                if isinstance(val, dict):
                    quotes[str(key)] = str(val.get("quote") or "")
                elif val is not None:
                    quotes[str(key)] = str(val)
        return data["fields"], quotes
    return data, {}


def build_extraction_prompt(markdown: str) -> str:
    """固定 JSON schema 的提取提示词。"""
    return f"""你正在分析一份券商研报。以下是从PDF中解析并清洗后的结构化Markdown内容。

请提取以下信息，输出为纯 JSON（不要 Markdown 代码块标记）：

{{
  "fields": {{
    "company_name": "公司名称，如贵州茅台",
    "stock_code": "证券代码，如600519.SH",
    "report_period": "报告期，如2026Q1",
    "rating": "投资评级，如买入/增持/优于大市",
    "revenue": {{"value": "营业收入数值", "change": "变动，如同比+18.5%"}},
    "net_profit": {{"value": "归母净利润数值", "change": "变动"}},
    "roe": {{"value": "加权平均ROE", "change": "变动，可为空字符串"}},
    "total_assets": {{"value": "总资产", "change": "较年初变动"}},
    "net_assets": {{"value": "归母净资产", "change": "较年初变动"}},
    "business_segments": [
      {{"name": "业务名称", "value": "收入/规模", "growth": "增速或占比变化"}}
    ],
    "profit_forecast": [
      {{"year": "2026E", "revenue": "营业收入(百万元)", "net_profit": "净利润(百万元)"}},
      {{"year": "2027E", "revenue": "...", "net_profit": "..."}},
      {{"year": "2028E", "revenue": "...", "net_profit": "..."}}
    ],
    "core_view": "核心观点，一句话",
    "risks": "风险提示，分号分隔"
  }},
  "evidence": {{
    "company_name": {{"quote": "原文中出现公司名的最短连续片段"}},
    "stock_code": {{"quote": "原文中的证券代码片段"}},
    "report_period": {{"quote": "报告期原文"}},
    "rating": {{"quote": "评级原文"}},
    "revenue": {{"quote": "营业收入及同比所在句"}},
    "net_profit": {{"quote": "归母净利润所在句"}},
    "roe": {{"quote": "ROE 所在句"}},
    "total_assets": {{"quote": "总资产所在句"}},
    "net_assets": {{"quote": "净资产所在句"}},
    "core_view": {{"quote": "支撑核心观点的原文句"}},
    "risks": {{"quote": "风险提示原文"}}
  }}
}}

特别注意：
- 财务预测数据若在文末HTML表格中，请仔细解析表格提取数字（单位百万元）。
- 字符串字段禁止输出 null；找不到填"无"。
- MetricPair 的 change 找不到时填空字符串 ""。
- business_segments 为数组，按研报中出现的业务板块逐条列出；没有则 []。
- profit_forecast 尽量给出 2026E/2027E/2028E 三行；找不到的数字填"无"。
- evidence.quote 必须是下方 Markdown 中真实出现的连续原文；找不到则填空字符串。
- JSON key 必须与上述完全一致。

结构化Markdown内容：
{markdown}"""
