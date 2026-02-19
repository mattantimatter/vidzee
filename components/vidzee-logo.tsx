import type { SVGProps, ReactNode } from "react";

/**
 * Vidzee Logo — inline SVG React component.
 * Uses fill="currentColor" and stroke="currentColor" so it inherits
 * the parent's text color, automatically adapting to light/dark mode.
 */
export function VidzeeLogo(props: SVGProps<SVGSVGElement>): ReactNode {
  return (
    <svg
      viewBox="0 0 350 350"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M143.664 123.922V187.852C143.664 197.312 153.836 203.328 162.148 198.789L220.445 166.852C229.086 162.094 229.086 149.734 220.445 144.977L162.148 113.039C153.836 108.445 143.664 114.461 143.664 123.922Z"
        stroke="currentColor"
        strokeWidth="11"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M261.789 285.852H89.0313C63.2188 285.852 42.2188 264.906 42.2188 239.039V110.25C42.2188 84.4375 63.1641 63.4375 89.0313 63.4375H261.789C287.602 63.4375 308.602 84.3828 308.602 110.25V239.039C308.547 264.906 287.602 285.852 261.789 285.852Z"
        stroke="currentColor"
        strokeWidth="11"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M230.508 240.516C230.508 247.406 224.875 253.039 217.984 253.039C211.094 253.039 205.461 247.406 205.461 240.516C205.461 233.625 211.094 227.992 217.984 227.992C224.875 227.992 230.508 233.57 230.508 240.516Z"
        stroke="currentColor"
        strokeWidth="11"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M279.453 240.516H230.508"
        stroke="currentColor"
        strokeWidth="11"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M205.461 240.516H76.5078"
        stroke="currentColor"
        strokeWidth="11"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M266.547 303.625H83.4531C50.2031 303.625 23.2969 276.664 23.2969 243.469V106.586C23.2969 73.3359 50.2578 46.4297 83.4531 46.4297H266.602C299.852 46.4297 326.758 73.3906 326.758 106.586V243.469C326.758 276.664 299.797 303.625 266.547 303.625Z"
        stroke="currentColor"
        strokeWidth="11"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
