import Dither from "@/components/Dither";
import HeroSection from "@/components/landing/hero-section";
import Features from "@/components/landing/features";
import Agenda from "@/components/landing/agenda";
import CallToAction from "@/components/landing/call-to-action";

export default function Home() {
  return (
    <>
      <div className="absolute inset-x-0 top-0 h-dvh">
        <Dither
          waveColor={[0.30980392156862746, 0.30980392156862746, 0.30980392156862746]}
          disableAnimation={false}
          enableMouseInteraction={false}
          mouseRadius={0.3}
          colorNum={4}
          pixelSize={2}
          waveAmplitude={0.3}
          waveFrequency={3}
          waveSpeed={0.05}
        />
      </div>
      <HeroSection />
      <Features />
      <Agenda />
      <CallToAction />
    </>
  );
}
