// Set current year
document.getElementById('currentYear').textContent = new Date().getFullYear();

// Simple scroll animation
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// Optimize scroll animation using Intersection Observer API
if ('IntersectionObserver' in window) {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -75px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.card-hover').forEach(element => {
        observer.observe(element);
    });
} else {
    // Fallback for older browsers
    window.addEventListener('scroll', function() {
        const elements = document.querySelectorAll('.card-hover');
        elements.forEach(element => {
            const rect = element.getBoundingClientRect();
            if (rect.top < window.innerHeight * 0.75) {
                element.classList.add('visible');
            }
        });
    });
}