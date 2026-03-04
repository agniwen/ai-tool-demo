import {
  ArrowRightIcon,
  BriefcaseBusinessIcon,
  FileSearch2Icon,
  MessageCircleMoreIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from 'lucide-react';
import Link from 'next/link';
import { FadeContent } from '@/components/react-bits/fade-content';
import Prism from '@/components/react-bits/prism';
import { SplitText } from '@/components/react-bits/split-text';

const highlights = [
  {
    title: '多简历并行分析',
    description: '支持一次上传 8 份 PDF，自动提取要点并生成对比结论。',
    icon: FileSearch2Icon,
  },
  {
    title: '岗位语境驱动',
    description: '输入 JD 后，评分会围绕岗位能力模型展开，不再只看关键词。',
    icon: BriefcaseBusinessIcon,
  },
  {
    title: '可解释的建议',
    description: '输出亮点、风险点与追问建议，给出可落地的面试推进方向。',
    icon: ShieldCheckIcon,
  },
  {
    title: '聊天式交互',
    description: '围绕候选人和岗位持续追问，像和面试官共创评估结论一样自然。',
    icon: MessageCircleMoreIcon,
  },
];

export default function HomePage() {
  return (
    <>
      <div aria-hidden='true' className='pointer-events-none fixed  inset-0 -z-20 overflow-hidden'>
        <Prism
          height={5}
          baseWidth={7.5}
          animationType='hover'
          glow={1}
          noise={0.2}
          transparent
          scale={3.3}
          hueShift={0}
          colorFrequency={2.5}
          hoverStrength={1}
          inertia={0.05}
          bloom={0.8}
          timeScale={0.3}
        />
      </div>
      <div
        aria-hidden='true'
        className='bg-mask pointer-events-none opacity-80 fixed inset-0 -z-10 bg-[linear-gradient(to_bottom,oklch(0.985_0.007_236.5/0.48),oklch(0.985_0.007_236.5/0.68)_42%,oklch(0.985_0.007_236.5/0.82)_100%)]'
      />

      <main
        className='relative mx-auto flex min-h-dvh w-full max-w-6xl items-center justify-center px-4 py-10 sm:px-8 sm:py-14'
        id='main-content'
      >

        <section className='relative w-full px-2 py-3 text-center sm:px-4'>
          <FadeContent>
            <p className='inline-flex items-center gap-2 bg-primary/8 px-3 py-1 rounded-full font-medium text-primary text-xs'>
              <SparklesIcon aria-hidden='true' className='size-3' />
              招聘效率工具
            </p>
          </FadeContent>

          <h1 className='pixel-title mt-5 mx-auto max-w-4xl text-balance font-bold text-3xl text-foreground leading-tight sm:text-5xl'>
            <SplitText text='用更快、更稳、更清晰的方式，完成简历初筛' />
          </h1>

          <FadeContent className='mt-4 mx-auto max-w-3xl' delay={0.1}>
            <p className='font-serif text-base text-muted-foreground leading-relaxed sm:text-lg'>
              这个网站为招聘团队提供聊天式简历分析体验，帮助你在短时间内识别候选人亮点、风险与面试价值，让每一次沟通都更有依据。
            </p>
          </FadeContent>

          <FadeContent className='mt-7 flex flex-wrap items-center justify-center gap-3' delay={0.2}>
            <Link
              className='group inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground text-sm transition-colors transition-transform duration-300 ease-out hover:-translate-y-0.5 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60'
              href='/chat'
            >
              立即开始筛选
              <ArrowRightIcon
                aria-hidden='true'
                className='size-4 transition-transform duration-300 ease-out group-hover:translate-x-0.5'
              />
            </Link>
            <Link
              className='inline-flex items-center gap-2 rounded-xl bg-card/70 px-5 py-3 ring-1 ring-border/70 font-medium text-foreground text-sm transition-colors transition-transform duration-300 ease-out hover:-translate-y-0.5 hover:bg-card focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60'
              href='/interview'
            >
              体验 AI 语音面试
            </Link>
            <a
              className='inline-flex items-center gap-2 rounded-xl px-5 py-3 ring-transparent font-medium text-foreground text-sm transition-colors transition-transform duration-300 ease-out hover:-translate-y-0.5 hover:bg-accent/50 bg-accent/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60'
              href='#features'
            >
              查看功能亮点
            </a>
          </FadeContent>

          <div className='mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4' id='features'>
            {highlights.map((item, index) => {
              const Icon = item.icon;

              return (
                <FadeContent
                  className='group relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-transparent bg-transparent p-6 text-center shadow-none ring-0 backdrop-blur-0 transition-all duration-300 ease-out hover:-translate-y-1 hover:border-white/55 hover:bg-white/32 hover:shadow-[0_24px_50px_-34px_rgba(32,76,140,0.7)] hover:ring-white/35 hover:backdrop-blur-xl'
                  delay={0.34 + index * 0.1}
                  key={item.title}
                >
                  <div className='relative inline-flex size-10 items-center justify-center rounded-full border border-white/50 bg-white/40 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] transition-transform duration-300 ease-out group-hover:-translate-y-0.5'>
                    <Icon aria-hidden='true' className='size-5' />
                  </div>
                  <h3 className='relative mt-3 font-semibold text-xs text-foreground sm:text-sm'>
                    {item.title}
                  </h3>
                  <p className='relative mx-auto mt-1.5 max-w-[26ch] text-[11px] text-foreground/75 leading-relaxed sm:text-xs'>
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
