import Icon, { type IconName } from '../components/Icon'

export default function PlaceholderScreen({ title, icon, text }: { title: string; icon: IconName; text: string }) {
  return (
    <div className="screen">
      <h1 className="screen-title">
        <Icon name={icon} size={32} /> {title}
      </h1>
      <div className="card">
        <p className="muted big">{text}</p>
      </div>
    </div>
  )
}
