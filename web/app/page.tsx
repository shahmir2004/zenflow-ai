import { SmoothScroll } from '@/lib/motion/SmoothScroll';
import { Nav } from '@/components/landing/Nav';
import { Hero } from '@/components/landing/Hero';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { PoseLibrary } from '@/components/landing/PoseLibrary';
import { Faq } from '@/components/landing/Faq';
import { FooterCta } from '@/components/landing/FooterCta';
import { WarmBackend } from '@/components/landing/WarmBackend';

export default function LandingPage() {
  return (
    <SmoothScroll>
      <WarmBackend />
      <a className="skip-link" href="#poses">
        Skip to the pose library
      </a>
      <Nav />
      <main>
        <Hero />
        <HowItWorks />
        <PoseLibrary />
        <Faq />
        <FooterCta />
      </main>
    </SmoothScroll>
  );
}
