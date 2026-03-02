import {
  ArrowRightIcon,
  BriefcaseBusinessIcon,
  FileSearch2Icon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react";
import Link from "next/link";
import { FadeContent } from "@/components/react-bits/fade-content";
import { SplitText } from "@/components/react-bits/split-text";
import ColorBends from "@/components/react-bits/color-bends";

const highlights = [
  {
    title: "多简历并行分析",
    description: "支持一次上传 8 份 PDF，自动提取要点并生成对比结论。",
    icon: FileSearch2Icon,
  },
  {
    title: "岗位语境驱动",
    description: "输入 JD 后，评分会围绕岗位能力模型展开，不再只看关键词。",
    icon: BriefcaseBusinessIcon,
  },
  {
    title: "可解释的建议",
    description: "输出亮点、风险点与追问建议，给出可落地的面试推进方向。",
    icon: ShieldCheckIcon,
  },
];

const metrics = [
  { label: "支持上传", value: "8 份简历" },
  { label: "单文件上限", value: "10 MB" },
  { label: "交互方式", value: "聊天式评估" },
];

export default function HomePage() {
  return (
    <>
      <div aria-hidden="true" className="pointer-events-none fixed  inset-0 -z-20 overflow-hidden">
         <ColorBends
          rotation={55}
          speed={0.35}
          colors={["#29dbff","#0040ff"]}
          transparent={true}
          autoRotate={0}
          scale={1}
          frequency={1}
          warpStrength={1}
          mouseInfluence={1}
          parallax={0.5}
          noise={0.1}
        />
      </div>
      <div
        aria-hidden="true"
        className="bg-mask pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(to_bottom,oklch(0.985_0.007_236.5/0.48),oklch(0.985_0.007_236.5/0.68)_42%,oklch(0.985_0.007_236.5/0.82)_100%)]"
      />

      <main
        className="relative mx-auto min-h-dvh w-full max-w-6xl px-4 pt-10 pb-16 sm:px-8 sm:pt-14 sm:pb-20"
        id="main-content"
      >

      <section className="relative px-2 py-3 sm:px-4">
        <FadeContent>
          <p className="inline-flex items-center gap-2 bg-primary/8 px-3 py-1 rounded-full font-medium text-primary text-xs">
            <SparklesIcon aria-hidden="true" className="size-3" />
            招聘效率工具
          </p>
        </FadeContent>

        <h1 className="pixel-title mt-5 max-w-4xl text-balance font-bold text-3xl text-foreground leading-tight sm:text-5xl">
          <SplitText text="用更快、更稳、更清晰的方式，完成实习生简历初筛" />
        </h1>

        <FadeContent className="mt-4 max-w-3xl" delay={0.1}>
          <p className="font-serif text-base text-muted-foreground leading-relaxed sm:text-lg">
            这个网站为招聘团队提供聊天式简历分析体验，帮助你在短时间内识别候选人亮点、风险与面试价值，让每一次沟通都更有依据。
          </p>
        </FadeContent>

        <FadeContent className="mt-7 flex flex-wrap items-center gap-3" delay={0.2}>
          <Link
            className="group inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground text-sm transition-colors transition-transform duration-300 ease-out hover:-translate-y-0.5 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
            href="/chat"
          >
            立即开始筛选
            <ArrowRightIcon
              aria-hidden="true"
              className="size-4 transition-transform duration-300 ease-out group-hover:translate-x-0.5"
            />
          </Link>
          <a
            className="inline-flex items-center gap-2 rounded-xl px-5 py-3 font-medium text-foreground text-sm transition-colors transition-transform duration-300 ease-out hover:-translate-y-0.5 hover:bg-accent/50 bg-accent/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
            href="#features"
          >
            查看功能亮点
          </a>
        </FadeContent>

        <ul className="mt-8 grid gap-6 sm:grid-cols-3">
          {metrics.map((item, index) => (
            <FadeContent
              className="relative space-y-1 rounded-xl bg-white/36 px-4 py-3 ring-1 ring-border/55"
              delay={0.26 + index * 0.08}
              key={item.label}
            >
              <span
                aria-hidden="true"
                className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent"
              />
              <p className="font-medium text-muted-foreground text-xs">{item.label}</p>
              <p className="font-semibold text-foreground text-lg">{item.value}</p>
            </FadeContent>
          ))}
        </ul>

        <div className="mt-10 grid gap-4 sm:grid-cols-3" id="features">
          {highlights.map((item, index) => {
            const Icon = item.icon;

            return (
              <FadeContent
                className="group relative rounded-xl bg-white/36 p-5 ring-1 ring-border/55"
                delay={0.34 + index * 0.1}
                key={item.title}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent"
                />
                <div className="inline-flex size-10 items-center justify-center rounded-full bg-primary/12 text-primary transition-transform duration-300 ease-out group-hover:-translate-y-0.5">
                  <Icon aria-hidden="true" className="size-5" />
                </div>
                <h3 className="mt-4 font-semibold text-foreground text-lg">{item.title}</h3>
                <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
                  {item.description}
                </p>
              </FadeContent>
            );
          })}
        </div>
      </section>
      </main>
    </>
  );
}
