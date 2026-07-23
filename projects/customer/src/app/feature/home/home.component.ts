import { Component, OnInit, OnDestroy, inject, signal, ElementRef, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { InventoryService, InventoryItem, priceRange, activeArticles } from 'shared';

interface HeroSlide {
  eyebrow: string;
  headline: string;
  headlineAccent: string;
  subtitle: string;
  ctaLabel: string;
  ctaQueryParams?: Record<string, string>;
  theme: 'teal' | 'copper' | 'dark';
}

interface Testimonial {
  name: string;
  location: string;
  quote: string;
  rating: number;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule, NgOptimizedImage],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit, OnDestroy {
  private inventoryService = inject(InventoryService);

  priceRange = priceRange;
  activeArticles = activeArticles;

  featuredProducts = signal<InventoryItem[]>([]);
  isLoadingFeatured = signal(true);

  @ViewChild('featuredScroll') featuredScroll?: ElementRef<HTMLDivElement>;

  readonly categories = [
    { label: 'Eyeglasses', value: 'eyeglasses', icon: 'visibility' },
    { label: 'Sunglasses', value: 'sunglasses', icon: 'wb_sunny' },
    { label: 'Contact Lenses', value: 'contact_lens', icon: 'blur_circular' },
    { label: 'Accessories', value: 'accessory', icon: 'checkroom' },
  ];

  // --- Hero carousel ---
  // TODO: replace copy/theme below with real seasonal promos as they come up
  readonly heroSlides: HeroSlide[] = [
    {
      eyebrow: "Dehradun's Newest Optical Store — Now Online",
      headline: 'See the world,',
      headlineAccent: 'clearly.',
      subtitle: 'Premium frames, genuine lenses, and a free eyesight checkup with every visit — now just as easy to order online as it is to walk in.',
      ctaLabel: 'Shop Frames',
      theme: 'teal',
    },
    {
      eyebrow: 'Every Visit',
      headline: 'Free eye test,',
      headlineAccent: 'no strings attached.',
      subtitle: 'Walk in anytime for a complimentary eyesight checkup — no appointment needed.',
      ctaLabel: 'Visit Us',
      theme: 'copper',
    },
    {
      eyebrow: 'New Arrivals',
      headline: 'Sunglasses,',
      headlineAccent: 'made for summer.',
      subtitle: 'UV-protected, polarized, and priced fairly — built for real Dehradun sunshine.',
      ctaLabel: 'Explore Sunglasses',
      ctaQueryParams: { category: 'sunglasses' },
      theme: 'dark',
    },
  ];

  currentSlide = signal(0);
  private slideTimer?: ReturnType<typeof setInterval>;

  // --- Testimonials (static placeholder — swap for a real reviews source later) ---
  readonly testimonials: Testimonial[] = [
    {
      name: 'Priya Sharma',
      location: 'Dehradun',
      quote: "Ordered online, picked up in-store within the hour. The free eye test caught something my old prescription had missed.",
      rating: 5,
    },
    {
      name: 'Rohit Bisht',
      location: 'Rajpur Road',
      quote: 'Genuinely surprised by the frame quality at this price. No pushy upselling either — refreshing for an optical store.',
      rating: 5,
    },
    {
      name: 'Anjali Rawat',
      location: 'Clement Town',
      quote: "Customer support actually picks up the phone and knows what they're talking about. Rare these days.",
      rating: 4,
    },
  ];

  // --- Gallery tiles (decorative placeholder — swap for real lifestyle/customer photos later) ---
  readonly galleryTiles = [
    'linear-gradient(135deg, #1F4E5C, #2d6b7d)',
    'linear-gradient(135deg, #C97B4A, #e0a074)',
    'linear-gradient(135deg, #17282f, #1F4E5C)',
    'linear-gradient(135deg, #e0a074, #C97B4A)',
    'linear-gradient(135deg, #2d6b7d, #17282f)',
    'linear-gradient(135deg, #C97B4A, #1F4E5C)',
  ];

  ngOnInit(): void {
    this.inventoryService.list({ limit: 8 }).subscribe({
      next: (res) => {
        this.featuredProducts.set(res.items || []);
        this.isLoadingFeatured.set(false);
      },
      error: () => this.isLoadingFeatured.set(false),
    });

    this.startAutoAdvance();
  }

  ngOnDestroy(): void {
    if (this.slideTimer) clearInterval(this.slideTimer);
  }

  private startAutoAdvance(): void {
    this.slideTimer = setInterval(() => this.nextSlide(), 6000);
  }

  private resetAutoAdvance(): void {
    if (this.slideTimer) clearInterval(this.slideTimer);
    this.startAutoAdvance();
  }

  private nextSlide(): void {
    this.currentSlide.set((this.currentSlide() + 1) % this.heroSlides.length);
  }

  private prevSlide(): void {
    this.currentSlide.set((this.currentSlide() - 1 + this.heroSlides.length) % this.heroSlides.length);
  }

  onNextClick(): void {
    this.nextSlide();
    this.resetAutoAdvance();
  }

  onPrevClick(): void {
    this.prevSlide();
    this.resetAutoAdvance();
  }

  goToSlide(index: number): void {
    this.currentSlide.set(index);
    this.resetAutoAdvance();
  }

  scrollFeatured(direction: 'left' | 'right'): void {
    const el = this.featuredScroll?.nativeElement;
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  }

  thumbnailFor(item: InventoryItem): string | null {
    const article = activeArticles(item)[0];
    return article?.images?.[0] || null;
  }
}
