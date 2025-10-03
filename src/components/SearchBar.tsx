
interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}
export default function SearchBar({ value, onChange, placeholder }: Props) {
  return (
    <input
      className="input"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
